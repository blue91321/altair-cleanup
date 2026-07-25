import { DiscordHono } from "discord-hono";
import type { Env } from "./types.js";
import { runCleanup } from "./cleanup.js";

function summarize(r: Awaited<ReturnType<typeof runCleanup>>): string {
  const head =
    `${r.dryRun ? "🧪 **Dry run** — nothing was deleted.\n" : ""}` +
    `Scanned **${r.scanned}** messages, **${r.altairMessages}** from Altair, ` +
    `**${r.stale}** stale, **${r.deleted}** deleted.`;
  const lines = r.details.slice(0, 15).join("\n");
  const more = r.details.length > 15 ? `\n…and ${r.details.length - 15} more.` : "";
  return lines ? `${head}\n\`\`\`\n${lines}${more}\n\`\`\`` : head;
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
  .command("cleanup", (c) =>
    c.resDefer(async (c) => {
      const result = await runCleanup(c.env);
      await c.followup({ content: summarize(result) });
    }),
  )
  // Automatic trigger: the cron string MUST match one in wrangler.toml [triggers].
  .cron("*/15 * * * *", async (c) => {
    const result = await runCleanup(c.env as Env);
    console.log(
      `[cron cleanup] scanned=${result.scanned} altair=${result.altairMessages} ` +
        `stale=${result.stale} deleted=${result.deleted} dryRun=${result.dryRun}`,
    );
    for (const d of result.details) console.log(`  ${d}`);
  });

// `export default app` gives Cloudflare both the fetch (interactions) and
// scheduled (cron) handlers.
export default app;
