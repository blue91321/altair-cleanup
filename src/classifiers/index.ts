import type { DiscordMessage } from "../types.js";
import { messageTimestamps, isOverdue } from "./overdueTimestamp.js";

export interface Decision {
  /** Name of the rule that matched, for logging. */
  matched?: string;
  stale: boolean;
}

/**
 * Decide whether an (already Altair-authored) message is stale.
 *
 * Current rule: stale if the message carries any Discord timestamp at least
 * `graceSeconds` in the past. Messages with no timestamp are always kept.
 *
 * This is deliberately a single simple rule for now. Per-Altair-message-type
 * classifiers will be layered in here later.
 */
export function decide(msg: DiscordMessage, now: number, graceSeconds: number): Decision {
  if (messageTimestamps(msg).length === 0) return { stale: false };
  return { matched: "overdue-timestamp", stale: isOverdue(msg, now, graceSeconds) };
}
