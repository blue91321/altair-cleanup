import type { Env } from "./types.js";
import { fetchChannelMessages, deleteMessage } from "./discord.js";
import { decide } from "./classifiers/index.js";
import { getAllWatchedChannels } from "./watchlist.js";

export interface CleanupResult {
  scanned: number;
  altairMessages: number;
  stale: number;
  deleted: number;
  dryRun: boolean;
  details: string[];
}

/**
 * Scan the configured channels and delete stale Altair messages.
 * If DRY_RUN is "true", nothing is deleted; the result reports what would be.
 */
export async function runCleanup(env: Env): Promise<CleanupResult> {
  const now = Math.floor(Date.now() / 1000);
  const dryRun = env.DRY_RUN !== "false";
  const limit = Number(env.SCAN_LIMIT || "100");
  const channelIds = await getAllWatchedChannels(env);

  const result: CleanupResult = {
    scanned: 0,
    altairMessages: 0,
    stale: 0,
    deleted: 0,
    dryRun,
    details: [],
  };

  if (channelIds.length === 0) {
    result.details.push("No watched channels; use /watch add to add one.");
    return result;
  }

  for (const channelId of channelIds) {
    const messages = await fetchChannelMessages(channelId, env.DISCORD_BOT_TOKEN, limit);
    result.scanned += messages.length;

    for (const msg of messages) {
      if (msg.author.id !== env.ALTAIR_USER_ID) continue; // only Altair's messages
      if (msg.pinned) continue; // never touch pinned (e.g. Dynamic auto-updaters)
      result.altairMessages++;

      const { matched, stale } = decide(msg, now);
      if (!stale) continue;
      result.stale++;

      const label = matched?.name ?? "unknown";
      if (dryRun) {
        result.details.push(`[dry-run] would delete ${channelId}/${msg.id} (${label})`);
        continue;
      }

      const ok = await deleteMessage(channelId, msg.id, env.DISCORD_BOT_TOKEN);
      if (ok) {
        result.deleted++;
        result.details.push(`deleted ${channelId}/${msg.id} (${label})`);
      } else {
        result.details.push(`FAILED to delete ${channelId}/${msg.id} (${label})`);
      }
    }
  }

  return result;
}
