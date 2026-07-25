import { describe, it, expect, beforeEach } from "vitest";
import {
  addChannel,
  removeChannel,
  getGuildChannels,
  getAllWatchedChannels,
} from "../src/watchlist.js";
import type { Env } from "../src/types.js";

// Minimal in-memory KV mock covering the methods watchlist.ts uses.
function makeKV() {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
    list: async ({ prefix }: { prefix?: string; cursor?: string } = {}) => ({
      keys: [...store.keys()]
        .filter((k) => !prefix || k.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true as const,
      cursor: undefined,
    }),
  };
}

function makeEnv(cleanupChannelIds = ""): Env {
  return {
    WATCH_KV: makeKV() as unknown as KVNamespace,
    CLEANUP_CHANNEL_IDS: cleanupChannelIds,
  } as unknown as Env;
}

describe("watchlist", () => {
  let env: Env;
  beforeEach(() => {
    env = makeEnv();
  });

  it("adds a channel and lists it", async () => {
    const r = await addChannel(env, "guild1", "chanA");
    expect(r.added).toBe(true);
    expect(await getGuildChannels(env, "guild1")).toEqual(["chanA"]);
  });

  it("does not add duplicates", async () => {
    await addChannel(env, "guild1", "chanA");
    const r = await addChannel(env, "guild1", "chanA");
    expect(r.added).toBe(false);
    expect(r.channels).toEqual(["chanA"]);
  });

  it("removes a channel", async () => {
    await addChannel(env, "guild1", "chanA");
    await addChannel(env, "guild1", "chanB");
    const r = await removeChannel(env, "guild1", "chanA");
    expect(r.removed).toBe(true);
    expect(await getGuildChannels(env, "guild1")).toEqual(["chanB"]);
  });

  it("reports when removing a channel that isn't watched", async () => {
    const r = await removeChannel(env, "guild1", "nope");
    expect(r.removed).toBe(false);
  });

  it("aggregates channels across guilds and the static env fallback, deduped", async () => {
    env = makeEnv("static1, chanA");
    await addChannel(env, "guild1", "chanA"); // duplicate of static
    await addChannel(env, "guild1", "chanB");
    await addChannel(env, "guild2", "chanC");
    const all = await getAllWatchedChannels(env);
    expect(all.sort()).toEqual(["chanA", "chanB", "chanC", "static1"].sort());
  });
});
