import { describe, it, expect } from "vitest";
import { decide } from "../src/classifiers/index.js";
import type { DiscordMessage } from "../src/types.js";

const NOW = 1_700_000_000; // fixed "now" in unix seconds

function sortieMsg(expiresAt: number): DiscordMessage {
  return {
    id: "1",
    channel_id: "c",
    author: { id: "522879744786563075" },
    content: "",
    timestamp: new Date((NOW - 3600) * 1000).toISOString(),
    pinned: false,
    embeds: [
      {
        title: "Lephantis",
        fields: [
          { name: "Expires", value: `in <t:${expiresAt}:R>` },
          { name: "Solium (Eris) – Disruption", value: "Level: 50-60" },
        ],
      },
    ],
  };
}

describe("sortie classifier", () => {
  it("keeps a sortie that has not expired yet", () => {
    const d = decide(sortieMsg(NOW + 3600), NOW); // expires in 1h
    expect(d.matched?.name).toBe("sortie");
    expect(d.stale).toBe(false);
  });

  it("deletes a sortie that has expired", () => {
    const d = decide(sortieMsg(NOW - 60), NOW); // expired 1 min ago
    expect(d.matched?.name).toBe("sortie");
    expect(d.stale).toBe(true);
  });
});

describe("generic expiry classifier", () => {
  it("matches any embed with an Expires timestamp and deletes when past", () => {
    const msg: DiscordMessage = {
      id: "2",
      channel_id: "c",
      author: { id: "522879744786563075" },
      content: "",
      timestamp: new Date(NOW * 1000).toISOString(),
      pinned: false,
      embeds: [{ title: "Baro Ki'Teer", fields: [{ name: "Leaves", value: `<t:${NOW - 10}:R>` }] }],
    };
    const d = decide(msg, NOW);
    expect(d.matched?.name).toBe("expiry-timestamp");
    expect(d.stale).toBe(true);
  });

  it("keeps messages with no recognizable timestamp", () => {
    const msg: DiscordMessage = {
      id: "3",
      channel_id: "c",
      author: { id: "522879744786563075" },
      content: "",
      timestamp: new Date(NOW * 1000).toISOString(),
      pinned: false,
      embeds: [{ title: "Price check: Arcane Energize", description: "120p" }],
    };
    const d = decide(msg, NOW);
    expect(d.matched).toBeUndefined();
    expect(d.stale).toBe(false);
  });
});
