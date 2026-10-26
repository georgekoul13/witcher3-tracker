import type { AlchemyRecipe, GwentCard, Quest, ScavengerItem, Trophy } from "./types";

export interface Category {
  key: string;
  label: string;
  /** counts toward the headline 100% figure */
  core: boolean;
  done: number;
  total: number;
}

export interface Totals {
  categories: Category[];
  coreDone: number;
  coreTotal: number;
  pct: number;
}

/**
 * "100%" means the things the game actually asks for: every quest, every
 * trophy, every distinct Gwent card and every piece of witcher gear crafted.
 * Alchemy recipes and the guide's trivia lines are reference, not completion.
 */
export function computeTotals(args: {
  quests: Quest[];
  trophies: Trophy[];
  gwent: GwentCard[];
  scavenger: ScavengerItem[];
  alchemy: AlchemyRecipe[];
  questDone: Record<string, boolean>;
  trophyDone: Record<string, boolean>;
  gwentCollected: Record<string, boolean>;
  scavCrafted: Record<string, boolean>;
  alchemyKnown: Record<string, boolean>;
}): Totals {
  const {
    quests, trophies, gwent, scavenger, alchemy,
    questDone, trophyDone, gwentCollected, scavCrafted, alchemyKnown,
  } = args;

  // Gwent rows are copies of a card; a card counts once, collected if any copy is.
  const byCard = new Map<string, boolean>();
  for (const c of gwent) {
    if (!c.name) continue;
    const key = `${c.faction}:${c.name}`;
    byCard.set(key, (byCard.get(key) ?? false) || !!gwentCollected[c.id]);
  }

  const gear = scavenger.filter((s) => s.kind === "gear");

  const categories: Category[] = [
    {
      key: "quests", label: "Quests", core: true,
      done: quests.filter((q) => questDone[q.id]).length, total: quests.length,
    },
    {
      key: "trophies", label: "Trophies", core: true,
      done: trophies.filter((t) => trophyDone[t.id]).length, total: trophies.length,
    },
    {
      key: "gwent", label: "Gwent cards", core: true,
      done: [...byCard.values()].filter(Boolean).length, total: byCard.size,
    },
    {
      key: "gear", label: "Witcher gear", core: true,
      done: gear.filter((s) => scavCrafted[s.id]).length, total: gear.length,
    },
    {
      key: "alchemy", label: "Alchemy recipes", core: false,
      done: alchemy.filter((a) => alchemyKnown[a.id]).length, total: alchemy.length,
    },
  ];

  const core = categories.filter((c) => c.core);
  const coreDone = core.reduce((n, c) => n + c.done, 0);
  const coreTotal = core.reduce((n, c) => n + c.total, 0);
  return { categories, coreDone, coreTotal, pct: coreTotal ? coreDone / coreTotal : 0 };
}
