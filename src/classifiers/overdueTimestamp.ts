import type { DiscordMessage } from "../types.js";
import { extractDiscordTimestamps, embedText } from "../timestamps.js";

/** Every Discord <t:…> timestamp (unix seconds) anywhere in the message. */
export function messageTimestamps(msg: DiscordMessage): number[] {
  const out: number[] = [];
  if (msg.content) out.push(...extractDiscordTimestamps(msg.content));
  for (const embed of msg.embeds) out.push(...extractDiscordTimestamps(embedText(embed)));
  return out;
}

/**
 * Current staleness rule (intentionally simple; will be replaced by per-type
 * rules later): the message is stale if it contains any timestamp that is at
 * least `graceSeconds` in the past.
 */
export function isOverdue(msg: DiscordMessage, now: number, graceSeconds: number): boolean {
  return messageTimestamps(msg).some((ts) => ts <= now - graceSeconds);
}
