import { describe, it, expect } from "vitest";
import { isBaroInventory, baroStale, BARO_RULE } from "../src/classifiers/baro.js";
import { decide } from "../src/classifiers/index.js";
import type { DiscordMessage, DiscordEmbed } from "../src/types.js";

const NOW = Math.floor(Date.parse("2026-11-13T12:00:00Z") / 1000);
const DAY = 86_400;
const THREE_DAYS = 3 * DAY;

function msg(postedAtIso: string, embeds: DiscordEmbed[]): DiscordMessage {
  return {
    id: "1",
    channel_id: "c",
    author: { id: "a" },
    content: "",
    timestamp: postedAtIso,
    pinned: false,
    embeds,
  };
}

// The real message: posted 11/6, two ducats/credits tables, NO countdown.
const mainTable: DiscordEmbed = {
  fields: [
    { name: "__Ducats / Item__", value: "375 Ki'Teer Arrow Skin\n285 Eos Prime Armor Set\n500 Ki'Teer Straed Syandana" },
    { name: "__Credits__", value: "300,000\n260,000\n500,000" },
  ],
};
const tailTable: DiscordEmbed = {
  fields: [
    { name: "__Ducats / Item__", value: "15 Fae Path Ephemera\n0 Void Surplus\n100 Sands of Inaros Blueprint" },
    { name: "__Credits__", value: "1,000\n50,000\n25,000" },
  ],
};
const realMessage = msg("2026-11-06T06:03:00Z", [mainTable, tailTable]);

describe("isBaroInventory", () => {
  it("recognises a ducats/credits listing", () => {
    expect(isBaroInventory(realMessage)).toBe(true);
  });

  it("recognises a lone trailing table", () => {
    expect(isBaroInventory(msg("2026-11-06T06:03:00Z", [tailTable]))).toBe(true);
  });

  it("ignores a message mentioning only one currency", () => {
    const creditsOnly: DiscordEmbed = { fields: [{ name: "Reward", value: "50,000 Credits" }] };
    expect(isBaroInventory(msg("2026-11-06T06:03:00Z", [creditsOnly]))).toBe(false);
  });

  it("ignores unrelated Altair embeds", () => {
    const sortie: DiscordEmbed = { title: "Lephantis", fields: [{ name: "Expires", value: "<t:1:R>" }] };
    expect(isBaroInventory(msg("2026-11-06T06:03:00Z", [sortie]))).toBe(false);
  });
});

describe("baroStale", () => {
  it("deletes the untimed 11/6 listing seen on 11/13", () => {
    expect(baroStale(realMessage, NOW, THREE_DAYS)).toBe(true);
  });

  it("keeps a listing posted today", () => {
    expect(baroStale(msg("2026-11-13T06:00:00Z", [mainTable]), NOW, THREE_DAYS)).toBe(false);
  });

  it("keeps a listing still counting down, however old", () => {
    const live: DiscordEmbed = {
      fields: [
        { name: "Leaves", value: `<t:${NOW + 2 * DAY}:R>` },
        { name: "__Ducats / Item__", value: "100 Sands of Inaros Blueprint" },
        { name: "__Credits__", value: "25,000" },
      ],
    };
    expect(baroStale(msg("2026-10-01T06:00:00Z", [live]), NOW, THREE_DAYS)).toBe(false);
  });

  it("ignores non-Baro messages entirely", () => {
    const sortie: DiscordEmbed = { title: "Lephantis" };
    expect(baroStale(msg("2026-01-01T00:00:00Z", [sortie]), NOW, THREE_DAYS)).toBe(false);
  });
});

describe("decide() Baro integration", () => {
  const opts = {
    graceSeconds: 120,
    activeInvasionNodes: [] as string[],
    baroMaxAgeSeconds: THREE_DAYS,
  };

  it("flags the untimed listing no other rule could date", () => {
    const d = decide(realMessage, NOW, opts);
    expect(d.matched).toBe(BARO_RULE);
    expect(d.stale).toBe(true);
  });

  it("leaves a fresh listing alone", () => {
    const d = decide(msg("2026-11-13T06:00:00Z", [mainTable]), NOW, opts);
    expect(d.stale).toBe(false);
  });

  it("still prefers the timestamp rule when a past countdown exists", () => {
    const expired: DiscordEmbed = {
      fields: [
        { name: "Leaves", value: `<t:${NOW - DAY}:R>` },
        { name: "__Ducats / Item__", value: "100 Sands of Inaros Blueprint" },
        { name: "__Credits__", value: "25,000" },
      ],
    };
    const d = decide(msg("2026-11-10T06:00:00Z", [expired]), NOW, opts);
    expect(d.matched).toBe("overdue-timestamp");
    expect(d.stale).toBe(true);
  });
});
