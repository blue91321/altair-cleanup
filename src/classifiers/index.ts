import type { DiscordMessage } from "../types.js";
import { messageTimestamps, isOverdue } from "./overdueTimestamp.js";
import { isInvasionMessage, invasionStale } from "./invasion.js";
import { failsafeStale, FAILSAFE_RULE, type FailsafeConfig } from "./failsafe.js";

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
  /**
   * Last-resort phrase+age rule for messages no other rule can date. Omit to
   * disable it.
   */
  failsafe?: FailsafeConfig;
}

/**
 * Decide whether an (already Altair-authored) message is stale.
 *
 * Rules, in order:
 *  1. Invasion messages: stale once any invasion they reference is completed
 *     (verified against the worldstate API). Kept if the API is unavailable.
 *  2. Timestamped messages: stale once a Discord timestamp is at least
 *     `graceSeconds` in the past.
 *  3. Failsafe: a configured phrase in a sufficiently old message. Applies even
 *     when the rules above decline, so orphaned untimed posts can be cleared.
 *
 * Anything else is kept. Per-message-type rules can be layered in here.
 */
export function decide(msg: DiscordMessage, now: number, opts: DecideOptions): Decision {
  if (isInvasionMessage(msg)) {
    if (opts.activeInvasionNodes === null) return { matched: "invasion", stale: false };
    if (invasionStale(msg, opts.activeInvasionNodes)) return { matched: "invasion", stale: true };
    if (failsafeStale(msg, now, opts.failsafe)) return { matched: FAILSAFE_RULE, stale: true };
    return { matched: "invasion", stale: false };
  }

  if (messageTimestamps(msg).length > 0) {
    if (isOverdue(msg, now, opts.graceSeconds)) return { matched: "overdue-timestamp", stale: true };
    if (failsafeStale(msg, now, opts.failsafe)) return { matched: FAILSAFE_RULE, stale: true };
    return { matched: "overdue-timestamp", stale: false };
  }

  if (failsafeStale(msg, now, opts.failsafe)) return { matched: FAILSAFE_RULE, stale: true };
  return { stale: false };
}
