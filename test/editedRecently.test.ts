import { describe, it, expect } from "vitest";
import { editedRecently } from "../src/timestamps.js";
import type { DiscordMessage } from "../src/types.js";

const NOW = 1_700_000_000; // unix seconds
const DAY = 86_400;

function msg(editedAt?: number | null): DiscordMessage {
  return {
    id: "1",
    channel_id: "c",
    author: { id: "a" },
    content: "",
    timestamp: new Date((NOW - 5 * DAY) * 1000).toISOString(),
    edited_timestamp:
      editedAt === undefined || editedAt === null ? editedAt ?? null : new Date(editedAt * 1000).toISOString(),
    pinned: false,
    embeds: [],
  };
}

describe("editedRecently", () => {
  it("is false for a message that was never edited", () => {
    expect(editedRecently(msg(null), NOW, DAY)).toBe(false);
  });

  it("is true for a message edited moments ago (live Dynamic post)", () => {
    expect(editedRecently(msg(NOW - 60), NOW, DAY)).toBe(true);
  });

  it("is true just inside the one-day window", () => {
    expect(editedRecently(msg(NOW - (DAY - 60)), NOW, DAY)).toBe(true);
  });

  it("is false once the last edit is older than a day (abandoned)", () => {
    expect(editedRecently(msg(NOW - (DAY + 60)), NOW, DAY)).toBe(false);
  });

  it("is false for an unparseable edit timestamp", () => {
    const m = { ...msg(null), edited_timestamp: "not-a-date" } as DiscordMessage;
    expect(editedRecently(m, NOW, DAY)).toBe(false);
  });
});
