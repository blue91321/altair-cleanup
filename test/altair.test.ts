import { describe, it, expect } from "vitest";
import { isAltairMessage } from "../src/altair.js";
import type { DiscordMessage } from "../src/types.js";

const ID = { userId: "522879744786563075", webhookName: "Altair" };

function msg(over: Partial<DiscordMessage> & { author: DiscordMessage["author"] }): DiscordMessage {
  return {
    id: "1",
    channel_id: "c",
    content: "",
    timestamp: new Date().toISOString(),
    pinned: false,
    embeds: [],
    ...over,
  };
}

describe("isAltairMessage", () => {
  it("matches Altair's per-server webhook by exact name", () => {
    const m = msg({ author: { id: "1530169536941129729", username: "Altair" }, webhook_id: "1530169536941129729" });
    expect(isAltairMessage(m, ID)).toBe(true);
  });

  it("matches a different server's Altair webhook (different id, same name)", () => {
    const m = msg({ author: { id: "1530425422783713362", username: "Altair" }, webhook_id: "1530425422783713362" });
    expect(isAltairMessage(m, ID)).toBe(true);
  });

  it("does NOT match this bot's own 'Altair Cleanup' webhook replies", () => {
    const m = msg({ author: { id: "1530452805733716058", username: "Altair Cleanup" }, webhook_id: "1530452805733716058" });
    expect(isAltairMessage(m, ID)).toBe(false);
  });

  it("does NOT match a normal user named Altair (no webhook_id)", () => {
    const m = msg({ author: { id: "999", username: "Altair" } });
    expect(isAltairMessage(m, ID)).toBe(false);
  });

  it("still matches by bot user id when posting as the bot user", () => {
    const m = msg({ author: { id: "522879744786563075", username: "Altair", bot: true } });
    expect(isAltairMessage(m, ID)).toBe(true);
  });
});
