import { describe, it, expect } from "vitest";
import { fetchActiveInvasionNodes } from "../src/warframe.js";

function mockFetch(status: number, body: unknown) {
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as unknown as Response;
}

describe("fetchActiveInvasionNodes", () => {
  it("returns only the active (not completed) node strings", async () => {
    const body = [
      { node: "Gulliver (Phobos)", completed: true },
      { node: "Nuovo (Ceres)", completed: false },
      { node: "Themisto (Jupiter)", completed: true },
      { node: "Hades (Pluto)", completed: false },
    ];
    expect(await fetchActiveInvasionNodes("pc", mockFetch(200, body))).toEqual([
      "Nuovo (Ceres)",
      "Hades (Pluto)",
    ]);
  });

  it("returns null on a non-OK response", async () => {
    expect(await fetchActiveInvasionNodes("pc", mockFetch(503, {}))).toBeNull();
  });

  it("returns null when the fetch throws", async () => {
    const throwing = async () => {
      throw new Error("network");
    };
    expect(await fetchActiveInvasionNodes("pc", throwing)).toBeNull();
  });

  it("returns null when the payload isn't an array", async () => {
    expect(await fetchActiveInvasionNodes("pc", mockFetch(200, { error: "x" }))).toBeNull();
  });
});
