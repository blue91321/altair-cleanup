import type { DiscordMessage } from "../types.js";
import { embedText, messageAgeSeconds } from "../timestamps.js";
import { messageTimestamps } from "./overdueTimestamp.js";

export const FAILSAFE_RULE = "failsafe-old-text";

export interface FailsafeConfig {
  /** Phrases that mark a message as disposable once it is old enough. */
  phrases: string[];
  /** Minimum age, in seconds, before a phrase match may be deleted. */
  minAgeSeconds: number;
}

/** Everything textual in the message: content plus every embed. */
function messageText(msg: DiscordMessage): string {
  const parts = [msg.content ?? ""];
  for (const embed of msg.embeds ?? []) parts.push(embedText(embed));
  return parts.join("\n");
}

/**
 * Last-resort rule for messages nothing else can date.
 *
 * Some Altair posts carry no timestamp at all — notably the trailing parts of a
 * split notification whose timed parent has already been deleted. Those are
 * orphaned permanently, so a phrase match combined with a generous age gate lets
 * them finally be cleared.
 *
 * Guards: a message still counting down to a FUTURE time is never touched, and
 * nothing is deleted before `minAgeSeconds` has elapsed. With no phrases
 * configured the rule is inert.
 */
export function failsafeStale(
  msg: DiscordMessage,
  now: number,
  cfg?: FailsafeConfig,
): boolean {
  if (!cfg || cfg.phrases.length === 0) return false;
  // Anything still pointing at a future time is by definition current.
  if (messageTimestamps(msg).some((ts) => ts > now)) return false;
  if (messageAgeSeconds(msg, now) < cfg.minAgeSeconds) return false;

  const text = messageText(msg).toLowerCase();
  return cfg.phrases.some((phrase) => text.includes(phrase.toLowerCase()));
}

/** Parse the comma-separated phrase list from configuration. */
export function parsePhrases(raw: string | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
