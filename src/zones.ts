import type { Quest } from "./types";

/** Quest zones map onto map regions; this join needs no extra data. */
export const ZONE_TO_REGION: Record<string, string | null> = {
  "WHITE ORCHARD": "White Orchard",
  "VELEN": "Velen & Novigrad",
  "NOVIGRAD/OXENFURT": "Velen & Novigrad",
  "HEARTS OF STONE": "Velen & Novigrad",
  "SKELLIGE": "Skellige",
  "KAER MORHEN": "Kaer Morhen",
  "BLOOD AND WINE": "Toussaint",
  "VIZIMA": null,
};

export const REGION_TO_ZONES = (region: string) =>
  Object.entries(ZONE_TO_REGION)
    .filter(([, r]) => r === region)
    .map(([z]) => z);

export interface Standing {
  /** furthest guide position reached: the order of your latest completed main quest */
  position: number;
  /** the main quest that marks that position, for showing where you are */
  at: Quest | null;
  /** order-critical, still open, and already behind your position — real skips */
  behind: Quest[];
  /** order-critical and still ahead of you, in guide order */
  upcoming: Quest[];
  /** the next slice of `upcoming`: what to do before pushing on */
  closing: Quest[];
}

/** how many upcoming order-critical quests count as "closing soon" */
const WINDOW = 8;

/**
 * Where you are is a position in the guide's order, not a zone.
 *
 * The guide interleaves zones heavily — Velen runs from order 20 to 320,
 * Skellige 34 to 341, Novigrad 119 to 334 — so treating a zone as a story
 * stage flags a player who is following the order perfectly as dozens of
 * quests behind.
 *
 * Position comes from the furthest completed *main* quest, not the furthest
 * completed quest of any kind. One side quest ticked far ahead would otherwise
 * drag the frontier with it and invent skips behind it: the spreadsheet's own
 * starting state does exactly that, with a side quest at order 96 among
 * otherwise early ticks, which read as 53 missed quests on a fresh install.
 * Main quests are what actually move the story, and are rarely skipped.
 */
export function standing(
  quests: Quest[],
  done: Record<string, boolean>,
): Standing {
  const byOrder = [...quests].sort((a, b) => a.order - b.order);
  const mainDone = byOrder.filter((q) => done[q.id] && q.type === "main");
  const at = mainDone.length ? mainDone[mainDone.length - 1] : null;
  const position = at?.order ?? 0;

  const critical = byOrder.filter((q) => !done[q.id] && !q.anytime);
  const upcoming = critical.filter((q) => q.order >= position);

  return {
    position,
    at,
    behind: critical.filter((q) => q.order < position),
    upcoming,
    closing: upcoming.slice(0, WINDOW),
  };
}
