import type { Classifier, DiscordMessage } from "../types.js";
import { findExpiryTimestamp } from "../timestamps.js";

/**
 * Generic catch-all for any Altair notification that embeds a Discord
 * <t:UNIX:R> expiry timestamp (Sortie, Baro, Alerts, Arbitration, Invasions,
 * Fissures, Events, etc. — anything with an "Expires"/"Ends"/"Leaves" style
 * time). The message is stale once that timestamp is in the past.
 *
 * This is intentionally LAST in the registry so that a more specific classifier
 * for a given message type can override it.
 */
export const expiryTimestampClassifier: Classifier = {
  name: "expiry-timestamp",
  match(msg: DiscordMessage): boolean {
    return findExpiryTimestamp(msg) !== undefined;
  },
  isStale(msg: DiscordMessage, now: number): boolean {
    const expiry = findExpiryTimestamp(msg);
    if (expiry === undefined) return false;
    return now > expiry;
  },
};
