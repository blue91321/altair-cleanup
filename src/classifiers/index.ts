import type { DiscordMessage } from "../types.js";
import { messageTimestamps, isOverdue } from "./overdueTimestamp.js";
import { isInvasionMessage, invasionStale } from "./invasion.js";

export interface Decision {
  /** Name of the rule that matched, for logging. */
  matched?: string;
  stale: boolean;
}

export interface DecideOptions {
  /** Overdue-timestamp grace window, in seconds. */
  graceSeconds: number;
  /**
   * Currently-active invasion node strings from the worldstate API, or null when
   * the API could not be reached (in which case invasions are never deleted).
   */
  activeInvasionNodes: string[] | null;
}

/**
 * Decide whether an (already Altair-authored) message is stale.
 *
 * Rules, in order:
 *  1. Invasion messages: stale once any invasion they reference is completed
 *     (verified against the worldstate API). Kept if the API is unavailable.
 *  2. Everything else: stale if it carries a Discord timestamp at least
 *     `graceSeconds` in the past. Timestamp-less messages are kept.
 *
 * Per-Altair-message-type rules can continue to be layered in here.
 */
export function decide(msg: DiscordMessage, now: number, opts: DecideOptions): Decision {
  if (isInvasionMessage(msg)) {
    if (opts.activeInvasionNodes === null) return { matched: "invasion", stale: false };
    return { matched: "invasion", stale: invasionStale(msg, opts.activeInvasionNodes) };
  }
  if (messageTimestamps(msg).length === 0) return { stale: false };
  return { matched: "overdue-timestamp", stale: isOverdue(msg, now, opts.graceSeconds) };
}
