import { describe, it, expect } from "vitest";
import { isContinuationPart, linkContinuations, type MessageSlot } from "../src/classifiers/continuation.js";
import type { DiscordMessage, DiscordEmbed } from "../src/types.js";

const T0 = Date.parse("2026-08-21T06:01:00.000Z");
const iso = (offsetSec: number) => new Date(T0 + offsetSec * 1000).toISOString();
const WINDOW = 60;

function msg(id: string, offsetSec: number, embeds: DiscordEmbed[] = []): DiscordMessage {
  return {
    id,
    channel_id: "c",
    author: { id: "a" },
    content: "",
    timestamp: iso(offsetSec),
    pinned: false,
    embeds,
  };
}

// A Baro part: a Ducats/Item/Credits table with no timer of its own.
const baroTable = (items: string): DiscordEmbed => ({
  fields: [{ name: "Ducats / Item", value: items }, { name: "Credits", value: "25,000" }],
});
// The timed first part.
const baroTimed = (expiresAt: number): DiscordEmbed => ({
  title: "Baro Ki'Teer",
  fields: [{ name: "Expires", value: `<t:${expiresAt}:R>` }, { name: "Ducats / Item", value: "90 Poster" }],
});

function slot(msg: DiscordMessage, over: Partial<MessageSlot> = {}): MessageSlot {
  return { msg, candidate: true, stale: false, rule: "", ...over };
}

describe("isContinuationPart", () => {
  const parent = msg("p", 0, [baroTimed(1_700_000_000)]);

  it("accepts an untimed part posted seconds later", () => {
    expect(isContinuationPart(parent, msg("c1", 2, [baroTable("100 Sands of Inaros")]), WINDOW)).toBe(true);
  });

  it("rejects a part that carries its own timer (standalone notification)", () => {
    const timed = msg("c2", 2, [baroTimed(1_700_000_500)]);
    expect(isContinuationPart(parent, timed, WINDOW)).toBe(false);
  });

  it("rejects an invasion message (independently classifiable)", () => {
    const invasion = msg("c3", 2, [
      { title: "Nuovo (Ceres)", thumbnail: { url: "x/Notifications/Invasion.png" } },
    ]);
    expect(isContinuationPart(parent, invasion, WINDOW)).toBe(false);
  });

  it("rejects a part posted outside the window", () => {
    expect(isContinuationPart(parent, msg("c4", WINDOW + 5, [baroTable("x")]), WINDOW)).toBe(false);
  });

  it("rejects a part posted BEFORE the parent", () => {
    expect(isContinuationPart(parent, msg("c5", -5, [baroTable("x")]), WINDOW)).toBe(false);
  });
});

describe("linkContinuations", () => {
  // Discord order is newest-first: continuation(+2s) then parent(0s).
  it("drags an untimed follow-up part along with its stale parent", () => {
    const slots = [
      slot(msg("part2", 2, [baroTable("100 Sands of Inaros")])),
      slot(msg("part1", 0, [baroTimed(1_700_000_000)]), { stale: true, rule: "overdue-timestamp" }),
    ];
    linkContinuations(slots, WINDOW);
    expect(slots[0].stale).toBe(true);
    expect(slots[0].rule).toBe("overdue-timestamp+continuation");
  });

  it("leaves the follow-up alone while the parent is still live", () => {
    const slots = [
      slot(msg("part2", 2, [baroTable("100 Sands of Inaros")])),
      slot(msg("part1", 0, [baroTimed(1_700_000_000)])), // not stale
    ];
    linkContinuations(slots, WINDOW);
    expect(slots[0].stale).toBe(false);
  });

  it("links a chain of three parts", () => {
    const slots = [
      slot(msg("part3", 4, [baroTable("c")])),
      slot(msg("part2", 2, [baroTable("b")])),
      slot(msg("part1", 0, [baroTimed(1)]), { stale: true, rule: "overdue-timestamp" }),
    ];
    linkContinuations(slots, WINDOW);
    expect(slots.map((s) => s.stale)).toEqual([true, true, true]);
  });

  it("stops the chain at an unrelated non-Altair message", () => {
    const slots = [
      slot(msg("orphan", 4, [baroTable("c")])),
      slot(msg("someoneElse", 3), { candidate: false }),
      slot(msg("part1", 0, [baroTimed(1)]), { stale: true, rule: "overdue-timestamp" }),
    ];
    linkContinuations(slots, WINDOW);
    expect(slots[0].stale).toBe(false); // not dragged across the gap
  });

  it("stops the chain at a message with its own timer", () => {
    const slots = [
      slot(msg("later", 6, [baroTable("c")])),
      slot(msg("otherAlert", 3, [baroTimed(1_900_000_000)])), // future expiry, live
      slot(msg("part1", 0, [baroTimed(1)]), { stale: true, rule: "overdue-timestamp" }),
    ];
    linkContinuations(slots, WINDOW);
    expect(slots[1].stale).toBe(false);
    expect(slots[0].stale).toBe(false);
  });

  it("does nothing when no message is stale", () => {
    const slots = [slot(msg("b", 2, [baroTable("x")])), slot(msg("a", 0, [baroTable("y")]))];
    linkContinuations(slots, WINDOW);
    expect(slots.every((s) => !s.stale)).toBe(true);
  });
});
