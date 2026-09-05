# Altair Cleanup Bot

A Cloudflare Worker (TypeScript + [discord-hono](https://discord-hono.luis.fun/))
that deletes **stale messages posted by the [Altair](https://empx.cc/docs/altair/)
Warframe bot** — expired sorties, past Baro visits, ended alerts, etc.

It runs two ways:

- **Automatically** on a Cron Trigger (every 15 min by default).
- **Manually** via the `/cleanup` slash command.

## Choosing which channels to watch

Watched channels are managed at runtime with the `/watch` command (no redeploy
needed) and stored in a Cloudflare **KV namespace**, one list per server:

- `/watch add channel:#some-channel` — start watching a channel
- `/watch remove channel:#some-channel` — stop watching it
- `/watch list` — show the channels this server is watching

If a watched channel becomes inaccessible (deleted, or the bot loses access),
cleanup auto-removes it from the watch list and reports it the next time that
server runs `/watch list`.

Both `/watch` and `/cleanup` default to **Manage Server** permission. The cron
job scans every watched channel across all servers. (You can also set an
optional static `CLEANUP_CHANNEL_IDS` in `wrangler.toml`, merged with the KV
lists — normally leave it empty.)

### One-time KV setup

```bash
npx wrangler kv namespace create WATCH_KV
```

Paste the printed `id` into the `[[kv_namespaces]]` block in `wrangler.toml`
(replacing `REPLACE_WITH_KV_ID`).

## How it decides what to delete

Only messages **authored by Altair**, **not pinned**, and **not edited within the
last day** are ever considered. That last rule protects Altair's auto-updating
"Dynamic" posts, which continuously re-edit themselves — a recent edit means the
message is still live. (Window: `RECENT_EDIT_GRACE_SECONDS`, default 86400.)
Each candidate is run through a chain of **classifiers** (`src/classifiers/`).
The first classifier that recognizes a message decides whether it's stale.

- `invasion` — invasion alerts (single-node and the "Current Invasions"
  summary) carry no timestamp, so staleness is checked against the live
  worldstate API (`api.warframestat.us/<WORLDSTATE_PLATFORM>/invasions`). An
  invasion message is deleted once **any** invasion it references is no longer
  active (completed or rotated out of the worldstate). If the API is
  unreachable, invasion messages are never deleted.
- `overdue-timestamp` — everything else: stale once the message contains any
  Discord `<t:UNIX>` timestamp at least `STALE_GRACE_SECONDS` (default 120) in
  the past. Covers sorties, alerts, Baro, fissures and similar.
- Messages with no timestamp and no matching rule are **kept** (safe default).

**Multi-part posts.** Altair splits long notifications (Baro's inventory, for
example) across consecutive messages where only the **first** carries the expiry
timer. The trailing parts have nothing datable in them, so they are linked to
their parent and deleted with it — otherwise they would linger forever. A part
qualifies only if it carries no timestamp of its own, isn't independently
classifiable, and was posted within `CONTINUATION_WINDOW_SECONDS` (default 60)
of the message it follows; any unrelated message breaks the chain.

To support a new Altair message type, add a module under `src/classifiers/` and
branch to it from `decide()` in `src/classifiers/index.ts` (ahead of the
`overdue-timestamp` fallback).

## Deletion log

Every message the bot deletes is recorded (per server) with its **reconstructed
contents**, so you can audit what was removed after the fact:

- `/log view` — show recent deletions (add `count:` for 1-20, default 5)
- `/log clear` — wipe this server's records

Each entry shows when it was deleted, the channel, which rule matched
(`invasion`, `overdue-timestamp`, …) and a flattened copy of the message text
and embed fields. The log keeps the newest `DELETION_LOG_LIMIT` records per
server (default 50) in KV; older ones roll off automatically.

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
