import { describe, it, expect } from "vitest";
import { fetchDoneInvasionNodes } from "../src/warframe.js";

function mockFetch(status: number, body: unknown) {
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as unknown as Response;
}

describe("fetchDoneInvasionNodes", () => {
  it("returns only the completed node strings", async () => {
    const body = [
      { node: "Gulliver (Phobos)", completed: true },
      { node: "Nuovo (Ceres)", completed: false },
      { node: "Themisto (Jupiter)", completed: true },
    ];
    expect(await fetchDoneInvasionNodes("pc", mockFetch(200, body))).toEqual([
      "Gulliver (Phobos)",
      "Themisto (Jupiter)",
    ]);
  });

  it("returns null on a non-OK response", async () => {
    expect(await fetchDoneInvasionNodes("pc", mockFetch(503, {}))).toBeNull();
  });

  it("returns null when the fetch throws", async () => {
    const throwing = async () => {
      throw new Error("network");
    };
    expect(await fetchDoneInvasionNodes("pc", throwing)).toBeNull();
  });

  it("returns null when the payload isn't an array", async () => {
    expect(await fetchDoneInvasionNodes("pc", mockFetch(200, { error: "x" }))).toBeNull();
  });
});
