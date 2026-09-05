import type { DiscordMessage } from "../types.js";
import { messageTimestamps } from "./overdueTimestamp.js";
import { isInvasionMessage } from "./invasion.js";

/** One scanned message plus the verdict reached for it. */
export interface MessageSlot {
  msg: DiscordMessage;
  /** Altair-authored, not pinned, not recently edited — i.e. deletable at all. */
  candidate: boolean;
  stale: boolean;
  rule: string;
}

/**
 * Is `part` a follow-up piece of the message `prev`?
 *
 * Altair splits long notifications (Baro's inventory, for example) across
 * consecutive messages, and only the FIRST part carries the expiry timer. The
 * trailing parts have nothing datable in them, so on their own they would never
 * be flagged and would linger forever once the timed part is deleted.
 *
 * Kept deliberately tight to avoid dragging unrelated posts along: the part must
 * carry no timestamp of its own, not be independently classifiable, and have
 * been posted within `windowSeconds` of the message it follows.
 */
export function isContinuationPart(
  prev: DiscordMessage,
  part: DiscordMessage,
  windowSeconds: number,
): boolean {
  // Its own expiry means it stands alone and is judged on its own merits.
  if (messageTimestamps(part).length > 0) return false;
  // Invasions are verifiable against the worldstate API independently.
  if (isInvasionMessage(part)) return false;

  const prevAt = Date.parse(prev.timestamp);
  const partAt = Date.parse(part.timestamp);
  if (Number.isNaN(prevAt) || Number.isNaN(partAt)) return false;

  const gap = (partAt - prevAt) / 1000;
  return gap >= 0 && gap <= windowSeconds;
}

/**
 * Mark the trailing parts of any stale multi-part message as stale too.
 *
 * `slots` must be in Discord's native newest-first order, so a follow-up part
 * (posted AFTER its parent) sits at a LOWER index than the parent. Walking
 * outward from each stale message, the chain stops at the first message that
 * isn't a continuation — so an unrelated post breaks the link.
 */
export function linkContinuations(slots: MessageSlot[], windowSeconds: number): void {
  for (let i = slots.length - 1; i >= 0; i--) {
    if (!slots[i].candidate || !slots[i].stale) continue;

    for (let j = i - 1; j >= 0; j--) {
      const part = slots[j];
      if (!part.candidate) break;
      // Compare against the immediately preceding part so chains of 3+ work.
      if (!isContinuationPart(slots[j + 1].msg, part.msg, windowSeconds)) break;
      if (!part.stale) {
        part.stale = true;
        part.rule = `${slots[i].rule}+continuation`;
      }
    }
  }
}
