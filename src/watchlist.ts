import type { Env } from "./types.js";

// Watched channels are stored in KV, one key per guild:
//   watch:<guildId> -> JSON string array of channel IDs
// The /watch command edits a guild's list; the cleanup engine reads every
// guild's list (plus any static CLEANUP_CHANNEL_IDS fallback from wrangler.toml).
const PREFIX = "watch:";
const keyFor = (guildId: string) => `${PREFIX}${guildId}`;

// Channels auto-removed because they became inaccessible, pending a one-time
// notice the next time that guild runs /watch list.
const REMOVED_PREFIX = "removed:";
const removedKey = (guildId: string) => `${REMOVED_PREFIX}${guildId}`;

export async function getGuildChannels(env: Env, guildId: string): Promise<string[]> {
  const raw = await env.WATCH_KV.get(keyFor(guildId));
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function setGuildChannels(env: Env, guildId: string, ids: string[]): Promise<void> {
  if (ids.length) await env.WATCH_KV.put(keyFor(guildId), JSON.stringify(ids));
  else await env.WATCH_KV.delete(keyFor(guildId));
}

export async function addChannel(
  env: Env,
  guildId: string,
  channelId: string,
): Promise<{ added: boolean; channels: string[] }> {
  const current = await getGuildChannels(env, guildId);
  if (current.includes(channelId)) return { added: false, channels: current };
  const channels = [...current, channelId];
  await setGuildChannels(env, guildId, channels);
  return { added: true, channels };
}

export async function removeChannel(
  env: Env,
  guildId: string,
  channelId: string,
): Promise<{ removed: boolean; channels: string[] }> {
  const current = await getGuildChannels(env, guildId);
  if (!current.includes(channelId)) return { removed: false, channels: current };
  const channels = current.filter((id) => id !== channelId);
  await setGuildChannels(env, guildId, channels);
  return { removed: true, channels };
}

/** Guild IDs that currently have a watch list. */
export async function listWatchGuilds(env: Env): Promise<string[]> {
  const guilds: string[] = [];
  let cursor: string | undefined;
  do {
    const list = await env.WATCH_KV.list({ prefix: PREFIX, cursor });
    for (const k of list.keys) guilds.push(k.name.slice(PREFIX.length));
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return guilds;
}

/** Record channels auto-removed from a guild, to notify on the next /watch list. */
export async function recordAutoRemoved(
  env: Env,
  guildId: string,
  channelIds: string[],
): Promise<void> {
  if (channelIds.length === 0) return;
  const raw = await env.WATCH_KV.get(removedKey(guildId));
  const current = raw ? (JSON.parse(raw) as string[]) : [];
  const merged = [...new Set([...current, ...channelIds])];
  await env.WATCH_KV.put(removedKey(guildId), JSON.stringify(merged));
}

/** Read and clear the pending auto-removed notices for a guild. */
export async function takeAutoRemovedNotices(env: Env, guildId: string): Promise<string[]> {
  const raw = await env.WATCH_KV.get(removedKey(guildId));
  if (!raw) return [];
  await env.WATCH_KV.delete(removedKey(guildId));
  return JSON.parse(raw) as string[];
}

/**
 * Every channel ID the bot should scan, across all guilds, plus any static
 * CLEANUP_CHANNEL_IDS from wrangler.toml. Deduplicated (channel IDs are globally
 * unique in Discord).
 */
export async function getAllWatchedChannels(env: Env): Promise<string[]> {
  const ids = new Set<string>();

  for (const id of (env.CLEANUP_CHANNEL_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    ids.add(id);
  }

  let cursor: string | undefined;
  do {
    const list = await env.WATCH_KV.list({ prefix: PREFIX, cursor });
    for (const k of list.keys) {
      const raw = await env.WATCH_KV.get(k.name);
      if (raw) for (const id of JSON.parse(raw) as string[]) ids.add(id);
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return [...ids];
}
