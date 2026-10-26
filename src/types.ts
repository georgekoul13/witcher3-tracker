export type QuestType =
  | "main" | "side" | "contract" | "treasure_hunt"
  | "scavenger_hunt" | "chance_encounter" | "gwent_race";

export interface QuestDetail {
  text: string;
  seen: boolean;
  /** source the guide linked this note to — usually a timestamped video */
  url?: string;
}

export interface Quest {
  id: string;
  order: number;
  zone: string;
  name: string;
  rawName: string;
  level: number | null;
  type: QuestType;
  done: boolean;
  /** true = safe to do at any point; false = order-critical / missable */
  anytime: boolean;
  branch: string | null;
  row: number;
  notes?: string[];
  details: QuestDetail[];
  /** the guide's own link, almost always the wiki page for this quest */
  url?: string;
}

export interface Trophy {
  id: string;
  name: string;
  requirement: string;
  dlc: string;
  missable: boolean;
  spoiler: boolean;
  done: boolean;
  url?: string;
}

export interface GwentCard {
  id: string;
  faction: string;
  name: string | null;
  location: string | null;
  collected: boolean;
  row: number;
}

/** A pin the user drops themselves. Coordinates are map-image pixels. */
export interface Pin {
  id: string;
  map: string;
  x: number;
  y: number;
  label: string;
  category: string;
  questId: string | null;
  found: boolean;
  createdAt: number;
}

export type Bucket =
  | "quests" | "details" | "trophies" | "gwent"
  | "scavFound" | "scavCrafted" | "alchemy" | "markers";

/** A real map marker, from the witcher3map dataset (CC BY-NC-SA). */
export interface Marker {
  id: string;
  region: string;
  category: string;
  key: string;
  lat: number;
  lng: number;
  /** the real place or quest name, where the source data carries one */
  name?: string;
  /** enemy levels guarding this spot, where the source data says */
  levels?: number[];
  monsters?: string[];
}

export interface RegionConfig {
  /** tile folder on the witcher3map server */
  path: string;
  /** flat pixel space (CRS.Simple) rather than the default geographic CRS */
  simple: boolean;
  sWest: [number, number];
  nEast: [number, number];
  maxZoom: number;
}

export interface MarkerFile {
  source: { project: string; url: string; licence: string; note: string };
  regions: Record<string, RegionConfig>;
  markers: Marker[];
}

export interface Progress extends Record<Bucket, Record<string, boolean>> {
  pins: Pin[];
  /** questId -> markerId, built up by hand as you play */
  links: Record<string, string>;
  /** the last marker opened, so Home can say where you were */
  lastPlace?: LastPlace;
  /** "bucket:id" -> when it was ticked, so Home can show your last session */
  doneAt?: Record<string, number>;
}

export interface LastPlace {
  name: string;
  region: string;
  at: number;
  /** where it was, so the map can draw the line you have to walk */
  lat?: number;
  lng?: number;
}

export interface ScavengerItem {
  id: string;
  hunt: string;
  section: string | null;
  name: string;
  kind: "gear" | "purchase";
  found: boolean;
  crafted: boolean | null;
  row: number;
  col: number;
  /** wiki map image showing where this diagram is */
  url?: string;
}

export interface AlchemyRecipe {
  id: string;
  category: string;
  name: string;
  known: boolean;
  ingredients: string[];
  effect?: string | null;
  charges?: string | null;
  toxicity?: string | null;
  duration?: string | null;
  formula?: string | null;
  row: number;
}

export interface Landmark {
  name: string;
  mentions: number;
  sources: string[];
  refs: string[];
  map: string | null;
  x: number | null;
  y: number | null;
}
