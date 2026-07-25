import type { DiscordMessage } from "../types.js";
import { embedText } from "../timestamps.js";

// Warframe planets/locations that appear in invasion node labels. Used to
// validate extracted "Name (Planet)" tokens so we don't match stray text.
const PLANETS = new Set([
  "Mercury",
  "Venus",
  "Earth",
  "Lua",
  "Mars",
  "Phobos",
  "Deimos",
  "Ceres",
  "Jupiter",
  "Europa",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
  "Eris",
  "Sedna",
  "Void",
  "Kuva Fortress",
]);

const NODE_RE = /([A-Z][A-Za-z0-9'’.\- ]*?) \(([A-Za-z' ]+)\)/g;

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
  for (const e of msg.embeds) parts.push(e.title ?? "", embedText(e));
  return parts.join("\n");
}

/** Node labels ("Cassini (Saturn)") referenced anywhere in the message. */
export function extractInvasionNodes(msg: DiscordMessage): string[] {
  const text = invasionText(msg);
  const nodes = new Set<string>();
  for (const m of text.matchAll(NODE_RE)) {
    const name = m[1].trim();
    const planet = m[2].trim();
    if (PLANETS.has(planet)) nodes.add(`${name} (${planet})`);
  }
  return [...nodes];
}

/**
 * Stale if any invasion the message references is no longer active — i.e. it
 * has completed or rotated out of the worldstate. `activeNodes` are the node
 * strings currently `completed: false`. Messages we can't parse a node from are
 * kept (safe default).
 */
export function invasionStale(msg: DiscordMessage, activeNodes: string[]): boolean {
  const referenced = extractInvasionNodes(msg);
  if (referenced.length === 0) return false;
  const active = new Set(activeNodes);
  return referenced.some((node) => !active.has(node));
}
