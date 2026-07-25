import type { Classifier, DiscordMessage } from "../types.js";
import { sortieClassifier } from "./sortie.js";
import { expiryTimestampClassifier } from "./expiryTimestamp.js";

/**
 * The classifier registry. ORDER MATTERS: the first classifier whose match()
 * returns true owns the message. Put specific classifiers first and the generic
 * expiry catch-all LAST.
 *
 * To support a new Altair message type: create a file in this folder exporting a
 * Classifier, then add it to this array above the generic catch-all.
 */
export const classifiers: Classifier[] = [
  sortieClassifier,
  // ... add more specific Altair message-type classifiers here ...
  expiryTimestampClassifier, // keep last
];

export interface Decision {
  matched?: Classifier;
  stale: boolean;
}

/** Decide whether an (already Altair-authored) message is stale. */
export function decide(msg: DiscordMessage, now: number): Decision {
  for (const c of classifiers) {
    if (c.match(msg)) {
      return { matched: c, stale: c.isStale(msg, now) };
    }
  }
  // No classifier recognized it -> keep it (safe default).
  return { stale: false };
}
