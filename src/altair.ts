import type { DiscordMessage } from "./types.js";

export interface AltairIdentity {
  /** Altair's bot user id (for servers where it posts as the bot user). */
  userId: string;
  /** The exact name Altair's webhook posts under (case-insensitive). */
  webhookName: string;
}

/**
 * Whether a message was posted by Altair.
 *
 * Altair sends its notifications through a per-server WEBHOOK, so the author id
 * differs in every server and never equals its bot user id. We therefore match
 * a webhook message whose author name is EXACTLY the configured webhook name
 * ("Altair"). Exact match matters: it must catch "Altair" but not this bot's own
 * "Altair Cleanup" follow-up messages, which are also webhook-authored.
 */
export function isAltairMessage(msg: DiscordMessage, id: AltairIdentity): boolean {
  if (msg.author.id === id.userId) return true;
  if (msg.webhook_id) {
    const name = (msg.author.username ?? "").trim().toLowerCase();
    if (name === id.webhookName.trim().toLowerCase()) return true;
  }
  return false;
}
