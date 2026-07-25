import { describe, it, expect } from "vitest";
import { decide } from "../src/classifiers/index.js";
import type { DiscordMessage } from "../src/types.js";

const NOW = 1_700_000_000; // fixed "now" in unix seconds
const GRACE = 120; // 2 minutes

function msg(fields: { name: string; value: string }[], content = ""): DiscordMessage {
  return {
    id: "1",
    channel_id: "c",
    author: { id: "a" },
    content,
    timestamp: new Date(NOW * 1000).toISOString(),
    pinned: false,
    embeds: [{ title: "Something", fields }],
  };
}

describe("overdue-timestamp rule", () => {
  it("keeps a message whose only timestamp is in the future", () => {
    const d = decide(msg([{ name: "Expires", value: `<t:${NOW + 3600}:R>` }]), NOW, { graceSeconds: GRACE, activeInvasionNodes: [] });
    expect(d.stale).toBe(false);
  });

  it("keeps a timestamp that is past but within the grace window", () => {
    const d = decide(msg([{ name: "Expires", value: `<t:${NOW - 60}:R>` }]), NOW, { graceSeconds: GRACE, activeInvasionNodes: [] }); // 1 min ago
    expect(d.stale).toBe(false);
  });

  it("deletes once a timestamp is more than the grace window overdue", () => {
    const d = decide(msg([{ name: "Expires", value: `<t:${NOW - 121}:R>` }]), NOW, { graceSeconds: GRACE, activeInvasionNodes: [] });
    expect(d.matched).toBe("overdue-timestamp");
    expect(d.stale).toBe(true);
  });

  it("is stale if ANY timestamp is overdue, even alongside future ones", () => {
    const d = decide(
      msg([
        { name: "Started", value: `<t:${NOW - 3600}:R>` },
        { name: "Expires", value: `<t:${NOW + 3600}:R>` },
      ]),
      NOW,
      { graceSeconds: GRACE, activeInvasionNodes: [] },
    );
    expect(d.stale).toBe(true);
  });

  it("keeps messages with no timestamp at all", () => {
    const d = decide(msg([{ name: "Price", value: "120p" }]), NOW, { graceSeconds: GRACE, activeInvasionNodes: [] });
    expect(d.matched).toBeUndefined();
    expect(d.stale).toBe(false);
  });

  it("also reads timestamps from message content", () => {
    const d = decide(msg([], `ended <t:${NOW - 600}:R>`), NOW, { graceSeconds: GRACE, activeInvasionNodes: [] });
    expect(d.stale).toBe(true);
  });
});
