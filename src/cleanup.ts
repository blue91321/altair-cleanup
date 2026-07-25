import type { Env } from "./types.js";
import { fetchChannelMessages, deleteMessage } from "./discord.js";
import { decide } from "./classifiers/index.js";
import { getAllWatchedChannels, getGuildChannels } from "./watchlist.js";
import { isAltairMessage, type AltairIdentity } from "./altair.js";
import { fetchActiveInvasionNodes } from "./warframe.js";

export interface CleanupResult {
  scanned: number;
  altairMessages: number;
  stale: number;
  deleted: number;
  dryRun: boolean;
  details: string[];
}

/**
 * Scan watched channels and delete stale Altair messages.
 *
 * Pass a `scope` with a guildId to limit the run to one server's watched
 * channels (used by the /cleanup command); omit it to scan every server's
 * channels (used by the cron). If DRY_RUN is "true", nothing is deleted.
 */
export async function runCleanup(env: Env, scope?: { guildId: string }): Promise<CleanupResult> {
  const now = Math.floor(Date.now() / 1000);
  const dryRun = env.DRY_RUN !== "false";
  const limit = Number(env.SCAN_LIMIT || "100");
  const channelIds = scope
    ? await getGuildChannels(env, scope.guildId)
    : await getAllWatchedChannels(env);
  const altair: AltairIdentity = {
    userId: env.ALTAIR_USER_ID,
    webhookName: env.ALTAIR_WEBHOOK_NAME || "Altair",
  };
  const graceSeconds = Number(env.STALE_GRACE_SECONDS || "120");
  // Fetched once per run; null if the worldstate API is unreachable.
  const activeInvasionNodes = await fetchActiveInvasionNodes(env.WORLDSTATE_PLATFORM || "pc");

  const result: CleanupResult = {
    scanned: 0,
    altairMessages: 0,
    stale: 0,
    deleted: 0,
    dryRun,
    details: [],
  };

  if (channelIds.length === 0) {
    result.details.push("No watched channels; use /watch add to add one.");
    return result;
  }

  for (const channelId of channelIds) {
    // One inaccessible channel (deleted, bot removed, etc.) must not abort the
    // whole run — skip it and report, keep scanning the rest.
    let messages;
    try {
      messages = await fetchChannelMessages(channelId, env.DISCORD_BOT_TOKEN, limit);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      result.details.push(`skipped ${channelId}: ${m.slice(0, 140)}`);
      continue;
    }
    result.scanned += messages.length;

    // Diagnostic: record the distinct authors seen, so a "0 from Altair" result
    // can reveal whether Altair posts under a different id / via a webhook.
    const authorsSeen = new Map<string, string>();
    for (const msg of messages) {
      const tag = `${msg.author.username ?? "?"}${msg.webhook_id ? " [webhook]" : msg.author.bot ? " [bot]" : ""}`;
      authorsSeen.set(msg.author.id, tag);
    }

    for (const msg of messages) {
      if (!isAltairMessage(msg, altair)) continue; // only Altair's messages
      if (msg.pinned) continue; // never touch pinned (e.g. Dynamic auto-updaters)
      result.altairMessages++;

      const { matched, stale } = decide(msg, now, { graceSeconds, activeInvasionNodes });
      if (!stale) continue;
      result.stale++;

      const label = matched ?? "unknown";
      if (dryRun) {
        result.details.push(`[dry-run] would delete ${channelId}/${msg.id} (${label})`);
        continue;
      }

      const ok = await deleteMessage(channelId, msg.id, env.DISCORD_BOT_TOKEN);
      if (ok) {
        result.deleted++;
        result.details.push(`deleted ${channelId}/${msg.id} (${label})`);
      } else {
        result.details.push(`FAILED to delete ${channelId}/${msg.id} (${label})`);
      }
    }

    // If we saw messages but none matched Altair, surface who WAS there.
    if (messages.length > 0 && !messages.some((m) => isAltairMessage(m, altair))) {
      const list = [...authorsSeen.entries()].map(([id, tag]) => `${tag}=${id}`).join(", ");
      result.details.push(`no Altair in ${channelId}; authors seen: ${list}`);
    }
  }

  return result;
}
