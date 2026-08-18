import { DiscordHono } from "discord-hono";
import type { Env } from "./types.js";
import { runCleanup } from "./cleanup.js";
import { addChannel, removeChannel, getGuildChannels, takeAutoRemovedNotices } from "./watchlist.js";
import { getLog, clearLog, type DeletionRecord } from "./deletionlog.js";

function summarize(r: Awaited<ReturnType<typeof runCleanup>>): string {
  const head =
    `${r.dryRun ? "🧪 **Dry run** — nothing was deleted.\n" : ""}` +
    `Scanned **${r.scanned}** messages, **${r.altairMessages}** from Altair, ` +
    `**${r.stale}** stale, **${r.deleted}** deleted` +
    `${r.autoRemoved ? `, **${r.autoRemoved}** inaccessible channel(s) auto-removed` : ""}.`;
  const lines = r.details.slice(0, 15).join("\n");
  const more = r.details.length > 15 ? `\n…and ${r.details.length - 15} more.` : "";
  return lines ? `${head}\n\`\`\`\n${lines}${more}\n\`\`\`` : head;
}


/**
 * Render deletion records for Discord. Kept well under the 2000-char message
 * limit by trimming both the number of entries and each entry's text.
 */
function renderLog(records: DeletionRecord[], limit: number): string {
  if (records.length === 0) {
    return "No deletions logged yet. Records appear here after cleanup removes an Altair message.";
  }
  const shown = records.slice(0, limit);
  const blocks = shown.map((r) => {
    const when = `<t:${r.deletedAt}:R>`;
    const body = r.summary.length > 300 ? `${r.summary.slice(0, 300)}…` : r.summary;
    return `**${when}** in <#${r.channelId}> · \`${r.rule}\`
>>> ${body}`;
  });

  let out = `🗑️ **Deleted messages** (showing ${shown.length} of ${records.length})

`;
  for (const b of blocks) {
    if (out.length + b.length + 2 > 1900) {
      out += "…output truncated; raise the limit or use `/log clear` after review.";
      break;
    }
    out += `${b}

`;
  }
  return out.trimEnd();
}

const app = new DiscordHono<{ Bindings: Env }>({
  // Map our secret names to what discord-hono expects.
  discordEnv: (env) => ({
    APPLICATION_ID: env.DISCORD_APPLICATION_ID,
    PUBLIC_KEY: env.DISCORD_PUBLIC_KEY,
    TOKEN: env.DISCORD_BOT_TOKEN,
  }),
})
  // Manual trigger: /cleanup
  // Deferred because scanning + deleting can take longer than Discord's 3s ACK.
  .command("cleanup", (c) => {
    const guildId = c.interaction.guild_id;
    if (!guildId) return c.ephemeral().res("Use this command inside a server.");
    return c.ephemeral().resDefer(async (c) => {
      try {
        const result = await runCleanup(c.env, { guildId });
        await c.followup({ content: summarize(result) });
      } catch (e) {
        // Without this, a thrown error leaves the interaction stuck "thinking".
        const msg = e instanceof Error ? e.message : String(e);
        await c.followup({ content: `⚠️ Cleanup failed: ${msg}` });
      }
    });
  })
  // /watch add|remove|list — manage which channels the cron watches for Altair.
  .command("watch", async (c) => {
    const guildId = c.interaction.guild_id;
    if (!guildId) return c.ephemeral().res("Use this command inside a server.");
    const env = c.env as Env;

    switch (c.sub.command) {
      case "add": {
        const channelId = (c.get as (k: string) => string)("channel");
        const { added, channels } = await addChannel(env, guildId, channelId);
        return c
          .ephemeral()
          .res(
            added
              ? `✅ Now watching <#${channelId}>. Watching ${channels.length} channel(s).`
              : `<#${channelId}> is already being watched.`,
          );
      }
      case "remove": {
        const channelId = (c.get as (k: string) => string)("channel");
        const { removed, channels } = await removeChannel(env, guildId, channelId);
        return c
          .ephemeral()
          .res(
            removed
              ? `🗑️ Stopped watching <#${channelId}>. Watching ${channels.length} channel(s).`
              : `<#${channelId}> was not being watched.`,
          );
      }
      case "list":
      default: {
        const channels = await getGuildChannels(env, guildId);
        const removed = await takeAutoRemovedNotices(env, guildId);
        const notice = removed.length
          ? `⚠️ Auto-removed ${removed.length} inaccessible channel(s) (deleted or no access): ${removed
              .map((id) => `<#${id}>`)
              .join(", ")}\n\n`
          : "";
        return c
          .ephemeral()
          .res(
            notice +
              (channels.length
                ? `Watching ${channels.length} channel(s):\n${channels.map((id) => `• <#${id}>`).join("\n")}`
                : "Not watching any channels yet. Use `/watch add` to add one."),
          );
      }
    }
  })
  // /log view|clear — inspect what cleanup has deleted in this server.
  .command("log", async (c) => {
    const guildId = c.interaction.guild_id;
    if (!guildId) return c.ephemeral().res("Use this command inside a server.");
    const env = c.env as Env;

    if (c.sub.command === "clear") {
      const n = await clearLog(env, guildId);
      return c.ephemeral().res(`🧹 Cleared ${n} logged deletion(s).`);
    }

    const count = Number((c.get as (k: string) => unknown)("count") ?? 5) || 5;
    const records = await getLog(env, guildId);
    return c.ephemeral().res(renderLog(records, Math.min(Math.max(count, 1), 20)));
  })
  // Automatic trigger: the cron string MUST match one in wrangler.toml [triggers].
  .cron("*/15 * * * *", async (c) => {
    const result = await runCleanup(c.env as Env);
    console.log(
      `[cron cleanup] scanned=${result.scanned} altair=${result.altairMessages} ` +
        `stale=${result.stale} deleted=${result.deleted} autoRemoved=${result.autoRemoved} ` +
        `dryRun=${result.dryRun}`,
    );
    for (const d of result.details) console.log(`  ${d}`);
  });

// `export default app` gives Cloudflare both the fetch (interactions) and
// scheduled (cron) handlers.
export default app;
