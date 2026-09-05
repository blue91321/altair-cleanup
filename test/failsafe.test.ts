import { describe, it, expect } from "vitest";
import { failsafeStale, parsePhrases, FAILSAFE_RULE } from "../src/classifiers/failsafe.js";
import { decide } from "../src/classifiers/index.js";
import type { DiscordMessage, DiscordEmbed } from "../src/types.js";

const NOW = 1_780_000_000; // unix seconds
const DAY = 86_400;
const WEEK = 7 * DAY;
const CFG = { phrases: ["Sands of Inaros Blueprint"], minAgeSeconds: WEEK };

function msg(ageSeconds: number, embeds: DiscordEmbed[] = [], content = ""): DiscordMessage {
  return {
    id: "1",
    channel_id: "c",
    author: { id: "a" },
    content,
    timestamp: new Date((NOW - ageSeconds) * 1000).toISOString(),
    pinned: false,
    embeds,
  };
}

// The real leftover: a Baro table fragment with no timer of its own.
const baroLeftover = (): DiscordEmbed => ({
  fields: [
    { name: "Ducats / Item", value: "100 Sands of Inaros Blueprint" },
    { name: "Credits", value: "25,000" },
  ],
});

describe("parsePhrases", () => {
  it("splits, trims and drops blanks", () => {
    expect(parsePhrases(" Sands of Inaros Blueprint , Void Surplus ,, ")).toEqual([
      "Sands of Inaros Blueprint",
      "Void Surplus",
    ]);
  });
  it("returns nothing for empty config", () => {
    expect(parsePhrases(undefined)).toEqual([]);
    expect(parsePhrases("")).toEqual([]);
  });
});

describe("failsafeStale", () => {
  it("deletes the orphaned Baro fragment once it is over a week old", () => {
    expect(failsafeStale(msg(WEEK + DAY, [baroLeftover()]), NOW, CFG)).toBe(true);
  });

  it("leaves the same message alone while it is under a week old", () => {
    expect(failsafeStale(msg(3 * DAY, [baroLeftover()]), NOW, CFG)).toBe(false);
  });

  it("ignores messages that do not contain a configured phrase", () => {
    const other: DiscordEmbed = { fields: [{ name: "Ducats / Item", value: "15 Fae Path Ephemera" }] };
    expect(failsafeStale(msg(WEEK + DAY, [other]), NOW, CFG)).toBe(false);
  });

  it("matches case-insensitively and in plain content", () => {
    expect(failsafeStale(msg(WEEK + DAY, [], "100 sands of INAROS blueprint"), NOW, CFG)).toBe(true);
  });

  it("never touches a message still counting down to a future time", () => {
    const live: DiscordEmbed = {
      fields: [
        { name: "Expires", value: `<t:${NOW + DAY}:R>` },
        { name: "Ducats / Item", value: "100 Sands of Inaros Blueprint" },
      ],
    };
    expect(failsafeStale(msg(WEEK + DAY, [live]), NOW, CFG)).toBe(false);
  });

  it("is inert when no phrases are configured", () => {
    expect(failsafeStale(msg(WEEK + DAY, [baroLeftover()]), NOW, { phrases: [], minAgeSeconds: WEEK })).toBe(false);
    expect(failsafeStale(msg(WEEK + DAY, [baroLeftover()]), NOW, undefined)).toBe(false);
  });
});

describe("decide() failsafe integration", () => {
  const opts = { graceSeconds: 120, activeInvasionNodes: [] as string[], failsafe: CFG };

  it("flags the untimed orphan that no other rule can date", () => {
    const d = decide(msg(WEEK + DAY, [baroLeftover()]), NOW, opts);
    expect(d.matched).toBe(FAILSAFE_RULE);
    expect(d.stale).toBe(true);
  });

  it("still keeps an untimed orphan that is too new", () => {
    const d = decide(msg(DAY, [baroLeftover()]), NOW, opts);
    expect(d.stale).toBe(false);
  });

  it("leaves normal behaviour intact when the failsafe is absent", () => {
    const d = decide(msg(WEEK + DAY, [baroLeftover()]), NOW, {
      graceSeconds: 120,
      activeInvasionNodes: [],
    });
    expect(d.matched).toBeUndefined();
    expect(d.stale).toBe(false);
  });
});
