import { Command, register } from "discord-hono";

// Slash command definitions. Run with: npm run register
const commands = [
  new Command("cleanup", "Scan configured channels and delete stale Altair messages."),
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

await register(commands, applicationId, token, guildId);
console.log(
  guildId
    ? `Registered ${commands.length} command(s) to guild ${guildId}.`
    : `Registered ${commands.length} global command(s) (may take up to 1 hour to appear).`,
);
