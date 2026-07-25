import { describe, it, expect } from "vitest";
import { isInvasionMessage, invasionStale } from "../src/classifiers/invasion.js";
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

describe("isInvasionMessage", () => {
  it("detects a single-invasion alert by its thumbnail", () => {
    expect(isInvasionMessage(m([{ title: "Nuovo (Ceres)", thumbnail: INVASION_THUMB }]))).toBe(true);
  });

  it("detects the multi-invasion summary by title", () => {
    expect(isInvasionMessage(m([{ title: "Current Invasions" }]))).toBe(true);
  });

  it("ignores non-invasion messages", () => {
    expect(isInvasionMessage(m([{ title: "E Gate (Venus)", thumbnail: { url: "x/Alert.png" } }]))).toBe(false);
  });
});

describe("invasionStale", () => {
  const single = m([{ title: "Nuovo (Ceres)", thumbnail: INVASION_THUMB, fields: [{ name: "__Corpus__", value: "x3 Fieldron" }] }]);
  const summary = m([
    {
      title: "Current Invasions",
      fields: [
        { name: "Cassini (Saturn) 94%", value: "x1 Snipetron Vandal Stock" },
        { name: "Nuovo (Ceres) 50%", value: "x3 Fieldron" },
      ],
    },
  ]);

  it("keeps a single alert whose invasion is still active", () => {
    expect(invasionStale(single, ["Gulliver (Phobos)"])).toBe(false);
  });

  it("deletes a single alert once its invasion is completed", () => {
    expect(invasionStale(single, ["Nuovo (Ceres)"])).toBe(true);
  });

  it("deletes the summary once ANY listed invasion is completed", () => {
    expect(invasionStale(summary, ["Cassini (Saturn)"])).toBe(true);
  });

  it("keeps the summary while all listed invasions are active", () => {
    expect(invasionStale(summary, ["Hades (Pluto)"])).toBe(false);
  });
});

describe("decide() invasion integration", () => {
  const single = m([{ title: "Nuovo (Ceres)", thumbnail: INVASION_THUMB }]);

  it("never deletes invasions when the worldstate API is unavailable", () => {
    const d = decide(single, 0, { graceSeconds: 120, doneInvasionNodes: null });
    expect(d.matched).toBe("invasion");
    expect(d.stale).toBe(false);
  });

  it("deletes when the referenced invasion is completed", () => {
    const d = decide(single, 0, { graceSeconds: 120, doneInvasionNodes: ["Nuovo (Ceres)"] });
    expect(d.stale).toBe(true);
  });
});
