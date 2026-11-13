import type { DiscordMessage, DiscordEmbed } from "../types.js";
import { embedText, messageAgeSeconds } from "../timestamps.js";
import { messageTimestamps } from "./overdueTimestamp.js";

export const BARO_RULE = "baro-inventory";

/**
 * Does this embed look like a Baro Ki'Teer inventory table?
 *
 * Baro's listing is the only Altair output priced in BOTH ducats and credits,
 * rendered as a two-column "Ducats / Item | Credits" table. Requiring both words
 * in the SAME embed keeps it from matching unrelated posts that merely mention
 * one currency.
 */
function isBaroEmbed(embed: DiscordEmbed): boolean {
  const text = embedText(embed).toLowerCase();
  return text.includes("ducat") && text.includes("credits");
}

/** Is this an Altair Baro Ki'Teer inventory message (any part of one)? */
export function isBaroInventory(msg: DiscordMessage): boolean {
  return (msg.embeds ?? []).some(isBaroEmbed);
}

/**
 * Baro's inventory listing is often posted with NO expiry timer at all — either
 * as the trailing part of a split notification, or as a whole message carrying
 * no countdown. Nothing else can date those, so they would linger forever.
 *
 * Baro stays for two days, so a listing older than `maxAgeSeconds` (default
 * three days) is certainly finished. A message still counting down to a FUTURE
 * time is never touched, so a live listing is safe regardless of age.
 */
export function baroStale(msg: DiscordMessage, now: number, maxAgeSeconds: number): boolean {
  if (!isBaroInventory(msg)) return false;
  // Still pointing at a future time → Baro is here, keep it.
  if (messageTimestamps(msg).some((ts) => ts > now)) return false;
  return messageAgeSeconds(msg, now) >= maxAgeSeconds;
}
