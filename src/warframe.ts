// Thin client for the community Warframe worldstate API (warframestat.us).
// Its `node` strings ("Cassini (Saturn)") match Altair's embed labels exactly,
// so we can detect completed invasions by substring.

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

interface ApiInvasion {
  node?: string;
  completed?: boolean;
}

/**
 * Node strings of invasions that are currently COMPLETED (`completed: true`).
 * Returns null on any failure so callers can safely decline to delete when the
 * worldstate can't be verified.
 */
export async function fetchDoneInvasionNodes(
  platform: string,
  fetchImpl: FetchLike = fetch,
): Promise<string[] | null> {
  try {
    const res = await fetchImpl(`https://api.warframestat.us/${platform}/invasions`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;
    return (data as ApiInvasion[])
      .filter((i) => i && i.completed === true && typeof i.node === "string")
      .map((i) => i.node as string);
  } catch {
    return null;
  }
}
