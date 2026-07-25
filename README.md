# Altair Cleanup Bot

A Cloudflare Worker (TypeScript + [discord-hono](https://discord-hono.luis.fun/))
that deletes **stale messages posted by the [Altair](https://empx.cc/docs/altair/)
Warframe bot** — expired sorties, past Baro visits, ended alerts, etc.

It runs two ways:

- **Automatically** on a Cron Trigger (every 15 min by default).
- **Manually** via the `/cleanup` slash command.

## How it decides what to delete

Only messages **authored by Altair** and **not pinned** are ever considered.
Each candidate is run through a chain of **classifiers** (`src/classifiers/`).
The first classifier that recognizes a message decides whether it's stale.

- `expiryTimestamp` — generic catch-all: any Altair embed containing a Discord
  `<t:UNIX:R>` expiry (an "Expires / Ends / Leaves" style field) is deleted once
  that time is in the past. This covers most notification types (Sortie, Baro,
  Alerts, Arbitration, Invasions, Fissures, Events, …).
- `sortie` — explicit handler for sortie posts (example of the per-type pattern).
- Anything no classifier recognizes is **kept** (safe default).

To add support for a new Altair message type, drop a new file in
`src/classifiers/` exporting a `Classifier` and add it to the array in
`src/classifiers/index.ts` (above the generic catch-all).

## Safety

`DRY_RUN` in `wrangler.toml` starts as `"true"`: the bot logs what it *would*
delete without deleting. Verify the logs / `/cleanup` output, then set it to
`"false"`.

## Setup

1. `npm install`
2. Create a Discord app at <https://discord.com/developers/applications>, add a
   **Bot**, and invite it to your server with **View Channel**, **Read Message
   History**, and **Manage Messages** permissions.
3. Copy `.dev.vars.example` → `.dev.vars` and fill in the token / IDs.
4. In `wrangler.toml`, set `CLEANUP_CHANNEL_IDS` to the channel(s) Altair posts in
   (enable Discord Developer Mode → right-click channel → Copy Channel ID).
5. Register the slash command: `npm run register`
   (set `DISCORD_GUILD_ID` first for instant, guild-scoped registration).
6. Set production secrets:
   ```bash
   wrangler secret put DISCORD_BOT_TOKEN
   wrangler secret put DISCORD_PUBLIC_KEY
   wrangler secret put DISCORD_APPLICATION_ID
   ```
7. `npm run deploy`
8. In the Discord Developer Portal, set the app's **Interactions Endpoint URL**
   to your deployed Worker URL.

## Commands

- `npm run dev` — local dev server
- `npm run register` — (re)register slash commands
- `npm run deploy` — deploy to Cloudflare
- `npm test` — run classifier unit tests
- `npm run typecheck` — type-check without emitting

## Verify against installed versions

Two spots depend on the exact `discord-hono` version and are flagged in code —
confirm after `npm install`: the deferred-response API in `src/index.ts`
(`c.resDefer` / `c.followup`) and the `.scheduled()` handler signature.
