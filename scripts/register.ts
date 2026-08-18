import { Command, SubCommand, Option, register } from "discord-hono";

// "32" = Manage Guild. Restricts these commands to server managers by default;
// server admins can further adjust via Server Settings → Integrations.
const MANAGE_GUILD = "32";

// Slash command definitions. Run with: npm run register
const commands = [
  new Command(
    "cleanup",
    "Scan watched channels and delete stale Altair messages.",
  ).default_member_permissions(MANAGE_GUILD),

  new Command("watch", "Manage which channels the bot watches for stale Altair messages.")
    .default_member_permissions(MANAGE_GUILD)
    .options(
      new SubCommand("add", "Watch a channel for stale Altair messages.").options(
        new Option("channel", "Channel to watch.", "Channel").required(),
      ),
      new SubCommand("remove", "Stop watching a channel.").options(
        new Option("channel", "Channel to stop watching.", "Channel").required(),
      ),
      new SubCommand("list", "List the channels currently being watched."),
    ),

  new Command("log", "View or clear the log of Altair messages this bot deleted.")
    .default_member_permissions(MANAGE_GUILD)
    .options(
      new SubCommand("view", "Show recently deleted messages and their contents.").options(
        new Option("count", "How many to show (1-20, default 5).", "Integer")
          .min_value(1)
          .max_value(20),
      ),
      new SubCommand("clear", "Delete all logged deletion records for this server."),
    ),
];

const applicationId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID; // optional: register instantly to one guild

if (!applicationId || !token) {
  console.error(
    "Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN in your environment before registering.",
  );
  process.exit(1);
}

// register() reports its own outcome and RESOLVES either way, so inspect the
// returned log text and fail loudly — otherwise CI reports a false success.
const result = await register(commands, applicationId, token, guildId);

if (result.includes("Error registering commands")) {
  console.error("Command registration FAILED (see the error above).");
  process.exit(1);
}

console.log(
  guildId
    ? `Registered ${commands.length} command(s) to guild ${guildId}.`
    : `Registered ${commands.length} global command(s) (may take up to 1 hour to appear).`,
);
