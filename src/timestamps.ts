import type { DiscordEmbed, DiscordMessage } from "./types.js";

// Discord renders <t:UNIX:STYLE> as a localized time. Altair's "Expires: in 11
// hours" is one of these with STYLE = R (relative). The raw text contains the
// absolute unix seconds, which is exactly what we need.
const DISCORD_TS = /<t:(\d+)(?::[tTdDfFR])?>/g;

/** Extract every unix-second timestamp embedded as <t:...> in a string. */
export function extractDiscordTimestamps(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(DISCORD_TS)) {
    out.push(Number(m[1]));
  }
  return out;
}

/** All text we might search for timestamps within a single embed. */
export function embedText(embed: DiscordEmbed): string {
  const parts: string[] = [];
  if (embed.title) parts.push(embed.title);
  if (embed.description) parts.push(embed.description);
  if (embed.footer?.text) parts.push(embed.footer.text);
  for (const f of embed.fields ?? []) {
    parts.push(f.name, f.value);
  }
  return parts.join("\n");
}

/**
 * Find the value of a field whose name loosely matches `label` (case-insensitive
 * substring), across all embeds. Returns undefined if not found.
 */
export function findFieldValue(
  msg: DiscordMessage,
  label: string,
): string | undefined {
  const needle = label.toLowerCase();
  for (const embed of msg.embeds) {
    for (const f of embed.fields ?? []) {
      if (f.name.toLowerCase().includes(needle)) return f.value;
    }
  }
  return undefined;
}

/**
 * The single expiry timestamp for a message, if one can be found.
 *
 * Strategy: prefer a timestamp inside an "Expires"/"Ends"-style field, then
 * fall back to any <t:...> anywhere in the embeds. When multiple timestamps
 * exist we take the LATEST one, so we never delete a message that still has a
 * future component (e.g. a multi-mission sortie).
 */
export function findExpiryTimestamp(msg: DiscordMessage): number | undefined {
  const labels = ["expire", "ends", "leaves", "closes", "until"];
  for (const label of labels) {
    const value = findFieldValue(msg, label);
    if (value) {
      const ts = extractDiscordTimestamps(value);
      if (ts.length) return Math.max(...ts);
    }
  }
  // Fallback: any timestamp anywhere in the embeds.
  const all: number[] = [];
  for (const embed of msg.embeds) {
    all.push(...extractDiscordTimestamps(embedText(embed)));
  }
  return all.length ? Math.max(...all) : undefined;
}

/** Age of a message in seconds, given `now` in unix seconds. */
export function messageAgeSeconds(msg: DiscordMessage, now: number): number {
  return now - Math.floor(new Date(msg.timestamp).getTime() / 1000);
}
