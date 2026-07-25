import type { Classifier, DiscordMessage } from "../types.js";
import { findExpiryTimestamp } from "../timestamps.js";

// Known daily-rotation sortie boss names shown in the embed title. Altair posts
// the sortie as a single embed titled with the boss (e.g. "Lephantis") plus an
// "Expires: in 11 hours" field. This exists as a dedicated classifier mostly to
// demonstrate the per-type pattern and to be a safe, explicit match for sorties
// even if the generic expiry heuristic ever changes.
const SORTIE_BOSSES = [
  "lephantis",
  "vay hek",
  "sargas ruk",
  "lech kril",
  "councilor vay hek",
  "phorid",
  "the sergeant",
  "kela de thaym",
  "tyl regor",
  "alad v",
  "ambulas",
  "hyena pack",
  "jackal",
  "raptor",
  "nef anyo",
];

function looksLikeSortie(msg: DiscordMessage): boolean {
  const title = msg.embeds[0]?.title?.toLowerCase() ?? "";
  if (SORTIE_BOSSES.some((b) => title.includes(b))) return true;
  return false;
}

export const sortieClassifier: Classifier = {
  name: "sortie",
  match(msg: DiscordMessage): boolean {
    return looksLikeSortie(msg) && findExpiryTimestamp(msg) !== undefined;
  },
  isStale(msg: DiscordMessage, now: number): boolean {
    const expiry = findExpiryTimestamp(msg);
    return expiry !== undefined && now > expiry;
  },
};
