import type { DiscordMessage } from "./types.js";

const API = "https://discord.com/api/v10";

/** An error carrying the HTTP status of a failed Discord API call. */
export class DiscordHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "DiscordHttpError";
    this.status = status;
  }
}

/** True when the status means the channel is gone or unreachable for the bot. */
export function isChannelInaccessible(status: number): boolean {
  return status === 403 || status === 404; // Missing Access / Unknown Channel
}

/** Fetch up to `limit` (max 100) most recent messages from a channel. */
export async function fetchChannelMessages(
  channelId: string,
  token: string,
  limit: number,
): Promise<DiscordMessage[]> {
  const url = `${API}/channels/${channelId}/messages?limit=${Math.min(limit, 100)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    throw new DiscordHttpError(
      res.status,
      `Failed to fetch messages for channel ${channelId}: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as DiscordMessage[];
}

/**
 * Delete a single message. Honors Discord's 429 rate limit by waiting and
 * retrying once. Returns true if deleted, false otherwise.
 */
export async function deleteMessage(
  channelId: string,
  messageId: string,
  token: string,
): Promise<boolean> {
  const url = `${API}/channels/${channelId}/messages/${messageId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bot ${token}` },
  });

  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
    const wait = Math.ceil((body.retry_after ?? 1) * 1000);
    await new Promise((r) => setTimeout(r, wait));
    const retry = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bot ${token}` },
    });
    return retry.ok || retry.status === 404;
  }

  // 404 = already gone, treat as success.
  return res.ok || res.status === 404;
}
