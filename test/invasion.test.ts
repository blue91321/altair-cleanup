import { describe, it, expect } from "vitest";
import { isInvasionMessage, invasionStale, extractInvasionNodes } from "../src/classifiers/invasion.js";
import { decide } from "../src/classifiers/index.js";
import type { DiscordMessage, DiscordEmbed } from "../src/types.js";

function m(embeds: DiscordEmbed[]): DiscordMessage {
  return {
    id: "1",
    channel_id: "c",
    author: { id: "a" },
    content: "",
    timestamp: new Date().toISOString(),
    pinned: false,
    embeds,
  };
}

const INVASION_THUMB = { url: "https://assets.empx.cc/Lotus/Interface/Icons/Notifications/Invasion.png" };

const single = m([{ title: "Outer Terminus (Pluto)", thumbnail: INVASION_THUMB, fields: [{ name: "__Corpus__", value: "x3 Fieldron" }] }]);
const summary = m([
  {
    title: "Current Invasions",
    fields: [
      { name: "Cassini (Saturn) 94%", value: "x1 Snipetron Vandal Stock" },
      { name: "Nuovo (Ceres) 50%", value: "x3 Fieldron" },
    ],
  },
]);

describe("isInvasionMessage", () => {
  it("detects a single-invasion alert by its thumbnail", () => {
    expect(isInvasionMessage(single)).toBe(true);
  });
  it("detects the multi-invasion summary by title", () => {
    expect(isInvasionMessage(summary)).toBe(true);
  });
  it("ignores non-invasion messages", () => {
    expect(isInvasionMessage(m([{ title: "E Gate (Venus)", thumbnail: { url: "x/Alert.png" } }]))).toBe(false);
  });
});

describe("extractInvasionNodes", () => {
  it("pulls the node from a single alert title", () => {
    expect(extractInvasionNodes(single)).toEqual(["Outer Terminus (Pluto)"]);
  });
  it("pulls every node from the summary fields, ignoring % suffixes", () => {
    expect(extractInvasionNodes(summary).sort()).toEqual(["Cassini (Saturn)", "Nuovo (Ceres)"].sort());
  });
});

describe("invasionStale (active-based)", () => {
  it("keeps a single alert whose invasion is still active", () => {
    expect(invasionStale(single, ["Outer Terminus (Pluto)"])).toBe(false);
  });
  it("deletes a single alert once its invasion has ended/rotated out", () => {
    expect(invasionStale(single, ["Nuovo (Ceres)"])).toBe(true); // not in active set
  });
  it("deletes the summary once ANY listed invasion is no longer active", () => {
    expect(invasionStale(summary, ["Nuovo (Ceres)"])).toBe(true); // Cassini gone
  });
  it("keeps the summary while all listed invasions are active", () => {
    expect(invasionStale(summary, ["Cassini (Saturn)", "Nuovo (Ceres)"])).toBe(false);
  });
});

describe("decide() invasion integration", () => {
  it("never deletes invasions when the worldstate API is unavailable", () => {
    const d = decide(single, 0, { graceSeconds: 120, activeInvasionNodes: null });
    expect(d.matched).toBe("invasion");
    expect(d.stale).toBe(false);
  });
  it("deletes when the referenced invasion is no longer active", () => {
    const d = decide(single, 0, { graceSeconds: 120, activeInvasionNodes: [] });
    expect(d.stale).toBe(true);
  });
});
