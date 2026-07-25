// Minimal shapes of the Discord objects we care about.

export interface DiscordUser {
  id: string;
  username?: string;
  bot?: boolean;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string; // ISO8601, the embed's footer timestamp
  footer?: { text?: string };
  author?: { name?: string };
  fields?: DiscordEmbedField[];
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  author: DiscordUser;
  content: string;
  timestamp: string; // ISO8601, when the message was posted
  pinned: boolean;
  embeds: DiscordEmbed[];
}

// Environment bindings (see wrangler.toml [vars] + secrets).
// Index signature keeps it assignable to discord-hono's Bindings constraint.
export interface Env {
  [key: string]: unknown;
  // Secrets
  DISCORD_BOT_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  // Vars
  ALTAIR_USER_ID: string;
  CLEANUP_CHANNEL_IDS: string;
  SCAN_LIMIT: string;
  DRY_RUN: string;
}

// A classifier decides, for one KIND of Altair message, whether that message
// is stale (safe to delete). Register one per Altair message type.
export interface Classifier {
  /** Human-readable name, used in logs. */
  name: string;
  /**
   * Does this classifier recognize the message? Return true only for the
   * specific Altair message type this classifier understands. The first
   * classifier (in registry order) whose match() returns true owns the message.
   */
  match(msg: DiscordMessage): boolean;
  /**
   * Given a message this classifier matched, is it stale / no longer relevant?
   * `now` is the current time in unix seconds.
   */
  isStale(msg: DiscordMessage, now: number): boolean;
}
