import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { CATEGORY_ICON, colorFor } from "./components/MapView";
import Icon, { type IconName } from "./components/Icons";
import Sheet from "./components/Sheet";
import Home from "./pages/Home";
import ListPage, { type ListRow } from "./pages/ListPage";
import Legend from "./pages/Legend";
import { computeTotals } from "./progress";
import { standing, ZONE_TO_REGION } from "./zones";
import { lastSession } from "./session";
import { exportProgress, importProgress, keepStorage, lastExportAt, storageState, useProgress } from "./store";
import type {
  AlchemyRecipe, Bucket, GwentCard, Marker as MapMarker, MarkerFile,
  Pin, Quest, ScavengerItem, Trophy,
} from "./types";
import questData from "./data/quests.json";
import trophyData from "./data/trophies.json";
import gwentData from "./data/gwent.json";
import scavengerData from "./data/scavenger.json";
import alchemyData from "./data/alchemy.json";
import markerData from "./data/markers.json";
import questLinkData from "./data/quest-links.json";

const quests = questData as Quest[];
const trophies = trophyData as Trophy[];
const gwent = gwentData as GwentCard[];
const scavenger = (scavengerData as { items: ScavengerItem[] }).items;
const alchemy = alchemyData as AlchemyRecipe[];
const markerFile = markerData as unknown as MarkerFile;
const REGIONS = Object.keys(markerFile.regions);

const DEV = new URLSearchParams(location.search).has("dev");

/**
 * Quest→marker links derived by matching the map's own marker labels against
 * quest names (see docs/handoff.md). They are a starting point, not a record
 * of anything you did, so a link you set by hand overrides the seeded one and
 * an empty string means you deliberately unlinked it.
 */
const SEEDED_LINKS: Record<string, string> = Object.fromEntries(
  (questLinkData as { links: { questId: string; markerId: string }[] })
    .links.map((l) => [l.questId, l.markerId]),
);
/** the map no longer filters, so this never changes */
const EMPTY_SET: Set<string> = new Set();

const PAGES = ["home", "map"] as const;
type Page = (typeof PAGES)[number];
const PAGE_META: Record<Page, { label: string; icon: IconName }> = {
  home: { label: "Home", icon: "nav-now" },
  map: { label: "Map", icon: "nav-map" },
};

type Detail =
  | { kind: "marker"; marker: MapMarker }
  | { kind: "quest"; quest: Quest }
  | null;

type Panel = "quests" | "other" | "info" | "regions" | "recent" | null;

/**
 * Where you were, kept across a relaunch.
 *
 * Android is free to kill a backgrounded app, and coming back to the Home
 * screen having lost the list you were halfway down is the single most
 * irritating thing a tracker can do. Only the route is stored — the drawer
 * keeps an id and looks the thing up again, so stale data can't be resurrected.
 */
const NAV_KEY = "w3tracker.nav.v1";

interface SavedNav {
  page: Page;
  panel: Panel;
  region: string;
  detail: { kind: "quest" | "marker"; id: string } | null;
}

function readNav(): SavedNav | null {
  try {
    const raw = localStorage.getItem(NAV_KEY);
    return raw ? (JSON.parse(raw) as SavedNav) : null;
  } catch {
    return null;   // private mode, or someone else's JSON in our key
  }
}

/** how each progress bucket reads in the last-session list */
const BUCKET_LABEL: Record<string, string> = {
  quests: "Quest", trophies: "Trophy", gwent: "Gwent card",
  scavFound: "Gear found", scavCrafted: "Gear made",
  alchemy: "Recipe", markers: "Map marker",
};

const TYPE_ICON: Record<string, IconName> = {
  main: "quest-main", side: "quest-side", contract: "quest-contract",
  treasure_hunt: "quest-treasure-hunt", scavenger_hunt: "quest-scavenger-hunt",
  chance_encounter: "quest-chance-encounter", gwent_race: "quest-gwent-race",
};

const TYPE_LABEL: Record<string, string> = {
  main: "Main quest", side: "Side quest", contract: "Contract",
  treasure_hunt: "Treasure hunt", scavenger_hunt: "Scavenger hunt",
  chance_encounter: "Chance encounter", gwent_race: "Gwent / race",
};

function overlay<T extends { id: string }>(
  rows: T[], base: (row: T) => boolean, stored: Record<string, boolean>,
) {
  const out: Record<string, boolean> = {};
  for (const row of rows) out[row.id] = base(row);
  return { ...out, ...stored };
}

export default function App() {
  const { progress, setProgress, toggle, setBucket, setLink, setLastPlace } = useProgress();
  /** read once, on the way in: later writes must not re-seed the screen */
  const saved = useRef(readNav()).current;
  const [page, setPage] = useState<Page>(saved?.page ?? "home");
  const [detail, setDetail] = useState<Detail>(() => {
    const d = saved?.detail;
    if (!d) return null;
    if (d.kind === "quest") {
      const q = quests.find((x) => x.id === d.id);
      return q ? { kind: "quest", quest: q } : null;
    }
    const m = markerFile.markers.find((x) => x.id === d.id);
    return m ? { kind: "marker", marker: m } : null;
  });
  const [region, setRegion] = useState(
    saved?.region && REGIONS.includes(saved.region) ? saved.region : REGIONS[0]);
  const [exportedAt, setExportedAt] = useState<number | null>(lastExportAt);
  const [storage, setStorage] = useState<{ persisted: boolean; usedKb: number | null }>(
    { persisted: false, usedKb: null });

  // ask once, on the way in, so progress stops being evictable
  useEffect(() => {
    keepStorage().then(() => storageState().then(setStorage));
  }, []);
  const [linking, setLinking] = useState<{ questId: string; questName: string } | null>(null);
  /** the pushed panels, opened from the map's header or from Home */
  const [panel, setPanel] = useState<Panel>(saved?.panel ?? null);
  /* the screen a panel was pushed from, so closing it goes back there. A
     restored panel was opened from whatever screen was saved underneath it. */
  const panelFrom = useRef<Page>(saved?.page ?? "map");
  /** which way the last move went, so the page animation slides to match */
  const [dir, setDir] = useState<"fwd" | "back">("fwd");

  /*
   * Android's back button arrives as a popstate, so navigation runs through
   * history: a forward step pushes an entry, and every back step — the
   * hardware button or the chevron in a header — is history.back(). That keeps
   * one unwind order for both, instead of two that can disagree.
   *
   * Back at Home pushes nothing, so the history we own is spent and Android
   * closes the app, which is what every other app on the phone does.
   */
  const view = useRef({ page, panel, detail });
  view.current = { page, panel, detail };

  const push = useCallback((apply: () => void) => {
    setDir("fwd");
    history.pushState(null, "");
    apply();
  }, []);
  const goBack = useCallback(() => history.back(), []);

  useEffect(() => {
    const onPop = () => {
      const v = view.current;
      setDir("back");
      if (v.detail) { setDetail(null); return; }
      if (v.panel) { setPanel(null); setPage(panelFrom.current); return; }
      if (v.page !== "home") setPage("home");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /*
   * A restored route needs the history to match it, or the first back press
   * would find nothing to unwind and close the app from halfway down a list.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;   // StrictMode runs this twice in development
    seeded.current = true;
    const deep = (saved?.page === "map" ? 1 : 0)
      + (saved?.panel ? 1 : 0) + (saved?.detail ? 1 : 0);
    for (let i = 0; i < deep; i++) history.pushState(null, "");
  }, [saved]);

  /** and keep it current, so the next cold start lands back here */
  useEffect(() => {
    const nav: SavedNav = {
      page, panel, region,
      detail: detail
        ? {
          kind: detail.kind,
          id: detail.kind === "quest" ? detail.quest.id : detail.marker.id,
        }
        : null,
    };
    try { localStorage.setItem(NAV_KEY, JSON.stringify(nav)); } catch { /* full or blocked */ }
  }, [page, panel, region, detail]);

  /** push a panel, remembering the screen it was opened from */
  const openPanel = useCallback(
    (which: NonNullable<typeof panel>, from: Page) => push(() => {
      panelFrom.current = from;
      setPanel(which);
    }), [push]);

  const questDone = useMemo(
    () => overlay(quests, (q) => q.done, progress.quests), [progress.quests]);
  const trophyDone = useMemo(
    () => overlay(trophies, (t) => t.done, progress.trophies), [progress.trophies]);
  const gwentCollected = useMemo(
    () => overlay(gwent, () => false, progress.gwent), [progress.gwent]);
  const scavFound = useMemo(
    () => overlay(scavenger, (s) => s.found, progress.scavFound), [progress.scavFound]);
  const scavCrafted = useMemo(
    () => overlay(scavenger, (s) => !!s.crafted, progress.scavCrafted), [progress.scavCrafted]);
  const alchemyKnown = useMemo(
    () => overlay(alchemy, (a) => a.known, progress.alchemy), [progress.alchemy]);

  const detailSeen = useMemo(() => {
    const base: Record<string, boolean> = {};
    for (const q of quests) q.details.forEach((d, i) => { base[`${q.id}:${i}`] = d.seen; });
    return { ...base, ...progress.details };
  }, [progress.details]);

  const totals = useMemo(() => computeTotals({
    quests, trophies, gwent, scavenger, alchemy,
    questDone, trophyDone, gwentCollected, scavCrafted, alchemyKnown,
  }), [questDone, trophyDone, gwentCollected, scavCrafted, alchemyKnown]);

  const here = useMemo(
    () => standing(quests, questDone), [questDone]);

  /** what the tracking screen is about: the next order-critical thing, else the next open one */
  const activeQuest = useMemo(
    () => here.closing[0] ?? here.upcoming[0] ?? null, [here]);

  /** the zone you are working through, read off the guide rather than set */
  const currentZone = activeQuest?.zone ?? here.at?.zone ?? quests[0].zone;

  /** every marker in the region: the map shows the lot, unfiltered */
  const regionMarkers = useMemo(
    () => markerFile.markers.filter((m) => m.region === region), [region]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of regionMarkers) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [regionMarkers]);

  /*
   * A drawer belongs to the screen it was opened from, so changing screen or
   * pushing a panel closes it. Closing a panel must not: opening a quest from
   * the list sets panel to null and the drawer in the same tick.
   */
  /* Guarded on the value rather than on "is this the first run": StrictMode
     runs effects twice in development, so a run-once flag is spent before the
     real render and the restored drawer gets closed on the way in. */
  const lastPage = useRef(page);
  const lastPanel = useRef(panel);
  useEffect(() => {
    if (lastPage.current === page) return;
    lastPage.current = page;
    setDetail(null);
  }, [page]);
  useEffect(() => {
    if (lastPanel.current === panel) return;
    lastPanel.current = panel;
    if (panel) setDetail(null);
  }, [panel]);

  /** what you ticked off the last time you played, newest first */
  const recent = useMemo(() => lastSession(progress.doneAt), [progress.doneAt]);

  /** "bucket:id" -> something readable, for the last-session list */
  const nameOf = useMemo(() => {
    const byBucket: Record<string, Map<string, string>> = {
      quests: new Map(quests.map((q) => [q.id, q.name])),
      trophies: new Map(trophies.map((t2) => [t2.id, t2.name])),
      gwent: new Map(gwent.filter((c) => c.name).map((c) => [c.id, c.name as string])),
      scavFound: new Map(scavenger.map((g) => [g.id, g.name])),
      scavCrafted: new Map(scavenger.map((g) => [g.id, g.name])),
      alchemy: new Map(alchemy.map((a) => [a.id, a.name])),
      markers: new Map(markerFile.markers.map((m) => [m.id, m.name ?? m.category])),
    };
    return (bucket: string, id: string) => byBucket[bucket]?.get(id);
  }, []);

  /** the three marker groups Home shows beside the four completion categories */
  const markerStats = useMemo(() => {
    const groups: { key: string; label: string; icon: IconName; cats: string[] }[] = [
      { key: "bandits", label: "Bandits", icon: "bandit-camp", cats: ["Bandit camp"] },
      { key: "nests", label: "Nests", icon: "monster-nest", cats: ["Monster nest"] },
      { key: "treasure", label: "Treasures", icon: "hidden-treasure",
        cats: ["Treasure", "Hidden treasure", "Guarded treasure", "Smuggler's cache"] },
    ];
    return groups.map((g) => {
      const set = new Set(g.cats);
      const rows = markerFile.markers.filter((m) => set.has(m.category));
      return {
        key: g.key, label: g.label, icon: g.icon,
        done: rows.filter((m) => progress.markers[m.id]).length,
        total: rows.length,
      };
    });
  }, [progress.markers]);

  const addPin = useCallback((pin: Omit<Pin, "id" | "createdAt">) => {
    setProgress((p) => ({
      ...p, pins: [...p.pins, { ...pin, id: crypto.randomUUID(), createdAt: Date.now() }],
    }));
  }, [setProgress]);
  const deletePin = useCallback((id: string) => {
    setProgress((p) => ({ ...p, pins: p.pins.filter((x) => x.id !== id) }));
  }, [setProgress]);

  const markerById = useMemo(() => {
    const m = new Map<string, MapMarker>();
    for (const x of markerFile.markers) m.set(x.id, x);
    return m;
  }, []);
  /** seeded links, with anything you set or cleared by hand taking precedence */
  const links = useMemo(() => {
    const merged: Record<string, string> = { ...SEEDED_LINKS, ...progress.links };
    for (const [questId, markerId] of Object.entries(merged)) {
      if (!markerId) delete merged[questId];
    }
    return merged;
  }, [progress.links]);

  /** the active quest's own spot, when it has one on the map you are looking at */
  const activeMarker = useMemo(() => {
    if (!activeQuest) return null;
    const m = markerById.get(links[activeQuest.id] ?? "");
    return m && m.region === region ? m : null;
  }, [activeQuest, links, region]);

  const linkedIds = useMemo(
    () => new Set(Object.values(links)), [links]);

  /** start picking a location for a quest: jump to its region and arm the map */
  const startLinking = useCallback((q: Quest) => {
    const r = ZONE_TO_REGION[q.zone];
    if (r) setRegion(r);
    setLinking({ questId: q.id, questName: q.name });
    setDetail(null);
    setPage("map");
  }, []);

  const t = (bucket: Bucket) => (id: string) => toggle(bucket, id);
  const openQuest = useCallback((q: Quest) => setDetail({ kind: "quest", quest: q }), []);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="app" data-page={page} data-dir={dir}>

      <main className="pagewrap">

        {!panel && page === "home" && (
          <>
          <Home totals={totals} markerStats={markerStats}
            lastPlace={progress.lastPlace} fallbackPlace={currentZone}
            lastSessionCount={recent.length} behind={here.behind.length}
            onStart={() => push(() => setPage("map"))}
            onOpenRecent={() => openPanel("recent", "home")}
            onOpenQuests={() => openPanel("quests", "home")}
            menu={[
              {
                label: "Export backup", icon: "export",
                note: exportedAt
                  ? `last ${new Date(exportedAt).toLocaleDateString()}`
                  : "never backed up",
                onPick: () => { exportProgress(progress); setExportedAt(Date.now()); },
              },
              {
                label: "Import backup", icon: "import",
                note: storage.persisted ? "storage is persistent" : "replaces everything",
                onPick: () => fileRef.current?.click(),
              },
            ]} />
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setProgress(await importProgress(f));
              e.target.value = "";
            }} />
          </>
        )}

        {panel === "quests" && (
          <ListPage title="Quests" onBack={goBack}
            tabs={[{
              key: "all", label: "Quests",
              // the guide's order is the product; it is deliberately not sortable
              rows: quests.map((q): ListRow => ({
                id: q.id,
                title: q.name,
                done: !!questDone[q.id],
                active: q.id === activeQuest?.id,
                chips: [
                  TYPE_LABEL[q.type] ?? q.type,
                  q.zone,
                  ...(q.level !== null ? [`lvl ${q.level}`] : []),
                  ...(q.anytime ? [] : ["order matters"]),
                ],
                onOpen: () => push(() => openQuest(q)),
                onSetDone: () => toggle("quests", q.id),
              })),
            }]} />
        )}

        {panel === "other" && (
          <ListPage title="Everything else" onBack={goBack}
            tabs={[
              {
                key: "gear", label: "Gear",
                // gear has two states and only "made" counts toward 100%
                rows: scavenger.filter((g) => g.kind === "gear").map((g): ListRow => ({
                  id: g.id, title: g.name, done: !!scavCrafted[g.id],
                  chips: [g.hunt, ...(g.section ? [g.section] : [])],
                  toggles: [
                    { label: "Found", on: !!scavFound[g.id],
                      onToggle: () => toggle("scavFound", g.id) },
                    { label: "Made", on: !!scavCrafted[g.id],
                      onToggle: () => toggle("scavCrafted", g.id) },
                  ],
                  onSetDone: () => toggle("scavCrafted", g.id),
                })),
              },
              {
                key: "gwent", label: "Gwent",
                rows: gwent.filter((c) => c.name).map((c): ListRow => ({
                  id: c.id, title: c.name ?? "", done: !!gwentCollected[c.id],
                  chips: [c.faction, ...(c.location ? [c.location] : [])],
                  toggles: [
                    { label: "Collected", on: !!gwentCollected[c.id],
                      onToggle: () => toggle("gwent", c.id) },
                  ],
                  onSetDone: () => toggle("gwent", c.id),
                })),
              },
              {
                key: "trophies", label: "Trophies",
                rows: trophies.map((t2): ListRow => ({
                  id: t2.id, title: t2.name, done: !!trophyDone[t2.id],
                  chips: t2.missable ? ["Missable"] : [],
                  toggles: [
                    { label: "Earned", on: !!trophyDone[t2.id],
                      onToggle: () => toggle("trophies", t2.id) },
                  ],
                  onSetDone: () => toggle("trophies", t2.id),
                })),
              },
              /* Markers had a tab here too, and it has gone: the map is where
                 you deal with them, a pin names itself on one tap and ticks
                 off on a hold, and they were never part of the 100% anyway. */
            ]} />
        )}

        {panel === "regions" && (
          <ListPage title="Switch map" search={false} onBack={goBack}
            tabs={[{
              key: "regions", label: "Maps",
              rows: REGIONS.map((r): ListRow => {
                const all = markerFile.markers.filter((m) => m.region === r);
                const found = all.filter((m) => progress.markers[m.id]).length;
                return {
                  id: r,
                  title: r,
                  chips: [
                    ...(r === region ? ["Showing now"] : []),
                    `${all.length} markers`,
                    `${found} found`,
                  ],
                  // picking a map is finishing with this panel, not going deeper
                  onOpen: () => { setRegion(r); goBack(); },
                };
              }),
            }]} />
        )}

        {panel === "recent" && (
          <ListPage title="Last session" search={false} onBack={goBack}
            tabs={[{
              key: "recent", label: "Last session",
              rows: recent.map((e): ListRow => ({
                id: `${e.bucket}:${e.id}`,
                title: nameOf(e.bucket, e.id) ?? e.id,
                chips: [
                  BUCKET_LABEL[e.bucket] ?? e.bucket,
                  new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                ],
              })),
            }]} />
        )}

        {panel === "info" && (
          <Legend categories={categories} onBack={goBack} />
        )}

        {!panel && page === "map" && (
          <div className="page track">
            <header className="track-head">
              <button className="icon-btn" onClick={goBack}
                aria-label="Back to home">
                <Icon name="chevron-right" size={22} className="flip" />
              </button>
              <div className="track-actions">
                <button className="icon-btn" onClick={() => openPanel("regions", "map")}
                  aria-label="Switch map">
                  <Icon name="switch-map" size={21} />
                </button>
                <button className="icon-btn" onClick={() => openPanel("quests", "map")}
                  aria-label="All quests">
                  <Icon name="nav-quests" size={21} />
                </button>
                <button className="icon-btn" onClick={() => openPanel("other", "map")}
                  aria-label="Everything else">
                  <Icon name="nav-collect" size={21} />
                </button>
                <button className="icon-btn" onClick={() => openPanel("info", "map")}
                  aria-label="What the pins mean">
                  <Icon name="info" size={21} />
                </button>
              </div>
            </header>

            <div className="track-map">
            <MapView
              region={region} config={markerFile.regions[region]}
              markers={regionMarkers} found={progress.markers}
              onToggleFound={t("markers")}
              selected={detail?.kind === "marker" ? detail.marker : null}
              onSelect={(m) => {
                if (!m) { setDetail(null); return; }
                push(() => {
                  setDetail({ kind: "marker", marker: m });
                  setLastPlace({
                    name: m.name ?? m.category, region: m.region, at: Date.now(),
                    lat: m.lat, lng: m.lng,
                  });
                });
              }}
              hiddenCategories={EMPTY_SET} hideFound={false}
              activeMarker={activeMarker}
              linkedIds={linkedIds}
              linking={linking}
              onPick={(markerId) => {
                if (!linking) return;
                setLink(linking.questId, markerId);
                setLinking(null);
              }}
              onCancelPick={() => setLinking(null)}
              pins={progress.pins} onAddPin={addPin} onDeletePin={deletePin}
              editable={DEV}
            />
              <p className="map-credit">
                Markers from{" "}
                <a href={markerFile.source.url} target="_blank" rel="noreferrer">witcher3map</a>
                {" "}· {markerFile.source.licence}
              </p>
            </div>

            {activeQuest && (
              <button className="active-quest"
                onClick={() => push(() => openQuest(activeQuest))}>
                <span className="active-quest-label">
                  <Icon name={TYPE_ICON[activeQuest.type] ?? "quest-side"} size={17} />
                  Active Quest
                </span>
                <strong>{activeQuest.name}</strong>
                <span className="active-quest-chips">
                  <i>{TYPE_LABEL[activeQuest.type] ?? activeQuest.type}</i>
                  <i>{activeQuest.zone}</i>
                  {activeQuest.level !== null && <i>lvl {activeQuest.level}</i>}
                </span>
              </button>
            )}
          </div>
        )}



      </main>


      <Sheet open={!!detail} onClose={goBack}>
        {detail?.kind === "marker" && (
          <MarkerDetail marker={detail.marker}
            found={!!progress.markers[detail.marker.id]}
            onToggle={() => toggle("markers", detail.marker.id)}
            linkedQuests={quests.filter(
              (q) => links[q.id] === detail.marker.id)}
            onOpenQuest={(q) => setDetail({ kind: "quest", quest: q })} />
        )}
        {detail?.kind === "quest" && (
          <QuestDetail quest={detail.quest} done={!!questDone[detail.quest.id]}
            detailSeen={detailSeen} onToggle={() => toggle("quests", detail.quest.id)}
            onToggleDetail={(k) => toggle("details", k)}
            linkedMarker={markerById.get(links[detail.quest.id] ?? "") ?? null}
            onLink={() => startLinking(detail.quest)}
            onGoToMarker={(m) => {
              setRegion(m.region);
              setDetail({ kind: "marker", marker: m });
              setLastPlace({
                name: m.name ?? m.category, region: m.region, at: Date.now(),
                lat: m.lat, lng: m.lng,
              });
              setPage("map");
            }}
            onShowOnMap={() => {
              const r = ZONE_TO_REGION[detail.quest.zone];
              if (r) { setRegion(r); setPage("map"); setDetail(null); }
            }} />
        )}
      </Sheet>
    </div>
  );
}

/** "youtu.be" -> "video", otherwise the bare host, for a link's tooltip */
function sourceLabel(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("youtu")) return "Open video";
    if (host.includes("fandom") || host.includes("wikia")) return "Open wiki";
    if (host.includes("reddit")) return "Open Reddit thread";
    return `Open ${host}`;
  } catch {
    return "Open source";
  }
}

function MarkerDetail({
  marker, found, onToggle, linkedQuests, onOpenQuest,
}: {
  marker: MapMarker;
  found: boolean;
  onToggle: () => void;
  linkedQuests: Quest[];
  onOpenQuest: (q: Quest) => void;
}) {
  return (
    <>
      <div className="sheet-head">
        <span className="sheet-icon" style={{ color: colorFor(marker.category) }}>
          <Icon name={CATEGORY_ICON[marker.category] ?? "point-of-interest"} size={22} />
        </span>
        <div>
          {/* the real name where the source has one, the category where it doesn't */}
          <h3>{marker.name ?? marker.category}</h3>
          <p>
            {marker.name ? `${marker.category} · ${marker.region}` : marker.region}
            {marker.levels?.length ? ` · level ${marker.levels.join(" & ")}` : ""}
            {found ? " · found" : ""}
          </p>
        </div>
      </div>

      <div className="sheet-actions">
        <button className={found ? "" : "primary"} onClick={onToggle}>
          {found ? "Mark not found" : "Mark found"}
        </button>
      </div>

      {marker.monsters?.length ? (
        <div className="sheet-section">
          <h4>Guarded by</h4>
          <ul className="tag-list">
            {marker.monsters.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="sheet-section">
        <h4>Quests here ({linkedQuests.length})</h4>
        {linkedQuests.length === 0 ? (
          <p className="now-hint">
            Nothing linked yet. Open a quest and choose <em>Set location</em> to
            point it at this spot.
          </p>
        ) : (
          <ul className="card-list">
            {linkedQuests.map((q) => (
              <li key={q.id} className="card-row">
                <button className="card-row-main" onClick={() => onOpenQuest(q)}>
                  <span className="card-row-title">
                    <Icon name="quest-main" size={14} />{q.name}
                  </span>
                  <span className="card-row-sub">
                    {q.zone}{q.level !== null && ` · lvl ${q.level}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sheet-section">
        <h4>Details</h4>
        <dl className="detail-grid">
          <dt>Category</dt><dd>{marker.category}</dd>
          <dt>Region</dt><dd>{marker.region}</dd>
          <dt>Position</dt><dd>{marker.lat.toFixed(1)}, {marker.lng.toFixed(1)}</dd>
        </dl>
      </div>
    </>
  );
}

function QuestDetail({
  quest, done, detailSeen, onToggle, onToggleDetail, onShowOnMap,
  linkedMarker, onLink, onGoToMarker,
}: {
  quest: Quest;
  done: boolean;
  detailSeen: Record<string, boolean>;
  onToggle: () => void;
  onToggleDetail: (key: string) => void;
  onShowOnMap: () => void;
  linkedMarker: MapMarker | null;
  onLink: () => void;
  onGoToMarker: (m: MapMarker) => void;
}) {
  const region = ZONE_TO_REGION[quest.zone];
  const seen = quest.details.filter((_, i) => detailSeen[`${quest.id}:${i}`]).length;

  return (
    <>
      <div className="sheet-head">
        <span className="sheet-icon" style={{ color: quest.anytime ? "#f6b26b" : "#e06666" }}>
          <Icon name={quest.anytime ? "quest-side" : "quest-main"} size={22} />
        </span>
        <div>
          <h3>{quest.name}</h3>
          <p>
            {quest.zone}
            {quest.level !== null && ` · lvl ${quest.level}`}
            {done && " · done"}
          </p>
        </div>
      </div>

      <div className="sheet-actions">
        <button className={done ? "" : "primary"} onClick={onToggle}>
          {done ? "Mark not done" : "Mark done"}
        </button>
        {quest.url && (
          <a className="btn" href={quest.url} target="_blank" rel="noreferrer">
            <Icon name="external-link" size={15} />
            Wiki
          </a>
        )}
      </div>

      <div className="sheet-section">
        <h4>Location</h4>
        {linkedMarker ? (
          <ul className="card-list">
            <li className="card-row">
              <span className="sheet-icon small"
                style={{ color: colorFor(linkedMarker.category) }}>
                <Icon name={CATEGORY_ICON[linkedMarker.category] ?? "point-of-interest"} size={16} />
              </span>
              <button className="card-row-main" onClick={() => onGoToMarker(linkedMarker)}>
                <span className="card-row-title">{linkedMarker.category}</span>
                <span className="card-row-sub">
                  {linkedMarker.region} · {linkedMarker.lat.toFixed(1)}, {linkedMarker.lng.toFixed(1)}
                </span>
              </button>
            </li>
          </ul>
        ) : (
          <>
            <p className="now-hint">
              No exact spot yet. Quests whose name matches a map marker are
              linked for you; the rest you point at a spot yourself.
            </p>
            <div className="sheet-actions" style={{ marginTop: 10 }}>
              <button className="primary" onClick={onLink}>Set location</button>
              {region && <button onClick={onShowOnMap}>Open {region}</button>}
            </div>
          </>
        )}
      </div>

      <div className="sheet-section">
        <h4>{quest.anytime ? "Timing" : "Why the order matters"}</h4>
        <p className="now-hint">
          {quest.anytime
            ? `Safe to do whenever you're passing through ${quest.zone}.`
            : `The guide places this at step ${quest.order} of 458. Doing it out of order can fail or hide other quests in ${quest.zone}.`}
          {quest.branch && ` This sits on ${quest.branch.toLowerCase()}.`}
        </p>
      </div>

      {quest.details.length > 0 && (
        <div className="sheet-section">
          <h4>Notes ({seen}/{quest.details.length} checked)</h4>
          <ul className="details">
            {quest.details.map((d, i) => {
              const key = `${quest.id}:${i}`;
              return (
                <li key={key} className={detailSeen[key] ? "seen" : ""}>
                  <input type="checkbox" checked={!!detailSeen[key]}
                    onChange={() => onToggleDetail(key)} />
                  <span>{d.text}</span>
                  {d.url && (
                    <a className="note-src" href={d.url} target="_blank"
                      rel="noreferrer" title={sourceLabel(d.url)}>
                      <Icon name="external-link" size={13} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
