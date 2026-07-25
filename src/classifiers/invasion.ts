import type { DiscordMessage } from "../types.js";
import { embedText } from "../timestamps.js";

/**
 * Is this an Altair invasion message? Covers both types:
 *  - single-invasion alert (title is the node, e.g. "Nuovo (Ceres)")
 *  - the multi-invasion summary (title "Current Invasions")
 * both of which carry the invasion notification thumbnail.
 */
export function isInvasionMessage(msg: DiscordMessage): boolean {
  for (const e of msg.embeds) {
    if ((e.title ?? "").trim().toLowerCase() === "current invasions") return true;
    if (/invasion/i.test(e.thumbnail?.url ?? "")) return true;
  }
  return false;
}

/** All searchable text of the message (content + every embed). */
function invasionText(msg: DiscordMessage): string {
  const parts = [msg.content ?? ""];
  for (const e of msg.embeds) parts.push(embedText(e));
  return parts.join("\n");
}

/**
 * Stale if ANY invasion node the message references is currently completed.
 * `doneNodes` are the completed node strings from the worldstate API; because
 * they're formatted exactly like Altair's labels, a substring test is reliable.
 */
export function invasionStale(msg: DiscordMessage, doneNodes: string[]): boolean {
  const text = invasionText(msg);
  return doneNodes.some((node) => node.length > 0 && text.includes(node));
}
