import type { Env, DiscordMessage } from "./types.js";

// Deleted-message records are stored in KV, one key per guild:
//   log:<guildId> -> JSON array of DeletionRecord, newest first, capped.
const PREFIX = "log:";
const keyFor = (guildId: string) => `${PREFIX}${guildId}`;

/** Max characters of reconstructed content kept per record. */
const MAX_SUMMARY = 900;

export interface DeletionRecord {
  /** Deleted message id. */
  id: string;
  /** Channel it was deleted from. */
  channelId: string;
  /** When we deleted it (unix seconds). */
  deletedAt: number;
  /** When the message was originally posted (ISO8601). */
  postedAt: string;
  /** Which rule flagged it (e.g. "invasion", "overdue-timestamp"). */
  rule: string;
  /** Human-readable reconstruction of what the message said. */
  summary: string;
}

/**
 * Flatten a message into readable text: its content plus each embed's title,
 * description and fields. This is what makes the log useful — the message
 * itself is gone from Discord, so the record has to stand on its own.
 */
export function summarizeMessage(msg: DiscordMessage): string {
  const parts: string[] = [];
  if (msg.content?.trim()) parts.push(msg.content.trim());

  for (const e of msg.embeds ?? []) {
    const seg: string[] = [];
    if (e.title) seg.push(e.title);
    if (e.description) seg.push(e.description);
    for (const f of e.fields ?? []) {
      const name = f.name?.trim();
      const value = f.value?.trim();
      if (name && value) seg.push(`${name}: ${value}`);
      else if (name) seg.push(name);
      else if (value) seg.push(value);
    }
    if (e.footer?.text) seg.push(e.footer.text);
    if (seg.length) parts.push(seg.join(" | "));
  }

  const text = parts.join("\n").replace(/\s*\n\s*/g, "\n").trim();
  if (!text) return "(no text content)";
  return text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY)}…` : text;
}

/** Build a record for a message about to be (or just) deleted. */
export function toRecord(
  msg: DiscordMessage,
  channelId: string,
  rule: string,
  deletedAt: number,
): DeletionRecord {
  return {
    id: msg.id,
    channelId,
    deletedAt,
    postedAt: msg.timestamp,
    rule,
    summary: summarizeMessage(msg),
  };
}

/** Read a guild's deletion log, newest first. */
export async function getLog(env: Env, guildId: string): Promise<DeletionRecord[]> {
  const raw = await env.WATCH_KV.get(keyFor(guildId));
  return raw ? (JSON.parse(raw) as DeletionRecord[]) : [];
}

/**
 * Prepend records to a guild's log, keeping only the most recent `limit`.
 * Written once per cleanup run per guild rather than per deletion.
 */
export async function appendLog(
  env: Env,
  guildId: string,
  records: DeletionRecord[],
  limit: number,
): Promise<void> {
  if (records.length === 0) return;
  const existing = await getLog(env, guildId);
  const merged = [...records, ...existing].slice(0, Math.max(1, limit));
  await env.WATCH_KV.put(keyFor(guildId), JSON.stringify(merged));
}

/** Delete a guild's log entirely. Returns how many records were cleared. */
export async function clearLog(env: Env, guildId: string): Promise<number> {
  const existing = await getLog(env, guildId);
  if (existing.length) await env.WATCH_KV.delete(keyFor(guildId));
  return existing.length;
}
