import { describe, it, expect, beforeEach } from "vitest";
import { summarizeMessage, toRecord, appendLog, getLog, clearLog } from "../src/deletionlog.js";
import type { Env, DiscordMessage } from "../src/types.js";

function makeKV() {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
  };
}

function makeEnv(): Env {
  return { WATCH_KV: makeKV() as unknown as KVNamespace } as unknown as Env;
}

function msg(over: Partial<DiscordMessage> = {}): DiscordMessage {
  return {
    id: "m1",
    channel_id: "c1",
    author: { id: "a" },
    content: "",
    timestamp: "2026-07-24T09:00:00.000Z",
    pinned: false,
    embeds: [],
    ...over,
  };
}

describe("summarizeMessage", () => {
  it("flattens an embed's title and fields", () => {
    const m = msg({
      embeds: [
        {
          title: "Nuovo (Ceres)",
          fields: [
            { name: "__Corpus__", value: "x3 Fieldron" },
            { name: "__Grineer__", value: "x3 Detonite Injector" },
          ],
        },
      ],
    });
    const s = summarizeMessage(m);
    expect(s).toContain("Nuovo (Ceres)");
    expect(s).toContain("__Corpus__: x3 Fieldron");
    expect(s).toContain("x3 Detonite Injector");
  });

  it("includes plain message content", () => {
    expect(summarizeMessage(msg({ content: "hello there" }))).toContain("hello there");
  });

  it("falls back when there is nothing to show", () => {
    expect(summarizeMessage(msg())).toBe("(no text content)");
  });

  it("truncates very long content", () => {
    const long = "x".repeat(5000);
    const s = summarizeMessage(msg({ content: long }));
    expect(s.length).toBeLessThan(1000);
    expect(s.endsWith("…")).toBe(true);
  });
});

describe("deletion log store", () => {
  let env: Env;
  beforeEach(() => {
    env = makeEnv();
  });

  it("starts empty", async () => {
    expect(await getLog(env, "g1")).toEqual([]);
  });

  it("stores records newest-first across appends", async () => {
    await appendLog(env, "g1", [toRecord(msg({ id: "old" }), "c1", "invasion", 100)], 50);
    await appendLog(env, "g1", [toRecord(msg({ id: "new" }), "c1", "overdue-timestamp", 200)], 50);
    const log = await getLog(env, "g1");
    expect(log.map((r) => r.id)).toEqual(["new", "old"]);
    expect(log[0].rule).toBe("overdue-timestamp");
  });

  it("caps the log at the configured limit", async () => {
    const many = Array.from({ length: 10 }, (_, i) => toRecord(msg({ id: `m${i}` }), "c1", "r", i));
    await appendLog(env, "g1", many, 4);
    expect((await getLog(env, "g1")).length).toBe(4);
  });

  it("ignores an empty append", async () => {
    await appendLog(env, "g1", [], 50);
    expect(await getLog(env, "g1")).toEqual([]);
  });

  it("keeps guild logs separate", async () => {
    await appendLog(env, "g1", [toRecord(msg({ id: "a1" }), "c1", "r", 1)], 50);
    await appendLog(env, "g2", [toRecord(msg({ id: "b1" }), "c2", "r", 1)], 50);
    expect((await getLog(env, "g1")).map((r) => r.id)).toEqual(["a1"]);
    expect((await getLog(env, "g2")).map((r) => r.id)).toEqual(["b1"]);
  });

  it("clears and reports how many were removed", async () => {
    await appendLog(env, "g1", [toRecord(msg(), "c1", "r", 1), toRecord(msg({ id: "m2" }), "c1", "r", 2)], 50);
    expect(await clearLog(env, "g1")).toBe(2);
    expect(await getLog(env, "g1")).toEqual([]);
  });

  it("records the rule, channel and original post time", async () => {
    await appendLog(env, "g1", [toRecord(msg(), "chan9", "invasion", 12345)], 50);
    const [r] = await getLog(env, "g1");
    expect(r).toMatchObject({ channelId: "chan9", rule: "invasion", deletedAt: 12345, postedAt: "2026-07-24T09:00:00.000Z" });
  });
});
