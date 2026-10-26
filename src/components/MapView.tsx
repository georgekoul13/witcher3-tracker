import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { iconMarkup, type IconName } from "./Icons";
import type { Marker as MapMarker, Pin, RegionConfig } from "../types";

/*
 * Tiles come from the psychodracon fork, which commits them to the repo, served
 * through jsDelivr: CORS enabled, no hotlink protection, proper CDN caching.
 * witcher3map.com's own server 403s any cross-origin referer.
 */
/**
 * How close to sit when the map is pointed at a particular place. One step in
 * from the zoom that fills the frame: enough to read the surroundings, where
 * two steps shows little but the pin itself.
 */
function focusZoom(map: L.Map, config: RegionConfig) {
  return Math.min(map.getMinZoom() + 1, config.maxZoom);
}

/** the shallowest zoom at which the fork publishes a complete tile grid */
const FULL_TILES = 3;

const TILES = "https://cdn.jsdelivr.net/gh/psychodracon/witcher3map@master/files/maps";

export const CATEGORY_ICON: Record<string, IconName> = {
  "Merchant": "merchant",
  "Innkeep": "innkeep",
  "Blacksmith": "blacksmith",
  "Armourer": "armourer",
  "Herbalist": "herbalist",
  "Barber": "barber",
  "Signpost": "signpost",
  "Entrance": "entrance",
  "Harbor": "harbor",
  "Guarded treasure": "guarded-treasure",
  "Hidden treasure": "hidden-treasure",
  "Smuggler's cache": "smugglers-cache",
  "Spoils of war": "spoils-of-war",
  "Bandit camp": "bandit-camp",
  "Monster nest": "monster-nest",
  "Monster den": "monster-den",
  "Vineyard infestation": "vineyard-infestation",
  "Hanse base": "hanse-base",
  "Contract": "contract",
  "Grindstone": "grindstone",
  "Armourer's table": "armourers-table",
  "Alchemy supplies": "alchemy-supplies",
  "Point of interest": "point-of-interest",
  // categories that arrived with the fork re-extraction
  "Treasure": "hidden-treasure",
  "Hollow": "hidden-treasure",
  "Honeycomb": "alchemy-supplies",
  "Boat": "harbor",
  "Scavenger": "quest-scavenger-hunt",
  "Event": "quest-chance-encounter",
  "Gwentquest": "gwent-card",
  "Abandoned site": "abandoned-site",
  "Place of power": "place-of-power",
  "Notice board": "notice-board",
  "Person in distress": "person-in-distress",
  "Child": "child",
  "Brothel": "brothel",
  "Signal fire": "signal-fire",
  "Gwent card": "gwent-card",
  "Side quest": "side-quest",
};

/** Colour groups the categories even though each has its own shape. */
const CATEGORY_COLOR: Record<string, string> = {
  "Merchant": "#ffd966", "Innkeep": "#ffd966", "Blacksmith": "#ffd966",
  "Armourer": "#ffd966", "Herbalist": "#ffd966", "Barber": "#ffd966",
  "Signpost": "#9aa0a6", "Entrance": "#9aa0a6", "Harbor": "#9aa0a6",
  "Guarded treasure": "#93c47d", "Hidden treasure": "#93c47d",
  "Smuggler's cache": "#93c47d", "Spoils of war": "#93c47d",
  "Bandit camp": "#cc8844", "Monster nest": "#cc8844", "Monster den": "#cc8844",
  "Vineyard infestation": "#cc8844", "Hanse base": "#cc8844", "Contract": "#cc8844",
  "Grindstone": "#3d85c6", "Armourer's table": "#3d85c6",
  "Alchemy supplies": "#7fd1c1",
  "Place of power": "#8e7cc3", "Signal fire": "#8e7cc3",
  "Notice board": "#f6b26b", "Side quest": "#f6b26b",
  "Person in distress": "#e06666", "Child": "#e06666", "Brothel": "#e06666",
  "Gwent card": "#a4c2f4",
  "Point of interest": "#b0a99a", "Abandoned site": "#b0a99a",
  "Treasure": "#93c47d", "Hollow": "#93c47d",
  "Honeycomb": "#7fd1c1", "Boat": "#9aa0a6",
  "Scavenger": "#f6b26b", "Event": "#f6b26b", "Gwentquest": "#a4c2f4",
};

export const colorFor = (category: string) =>
  CATEGORY_COLOR[category] ?? "#b0a99a";

interface Props {
  region: string;
  config: RegionConfig;
  markers: MapMarker[];
  found: Record<string, boolean>;
  onToggleFound: (id: string) => void;
  selected: MapMarker | null;
  onSelect: (marker: MapMarker | null) => void;
  hiddenCategories: Set<string>;
  hideFound: boolean;
  /** marker ids that a quest points at, drawn with a ring */
  linkedIds: Set<string>;
  /** when set, clicking a marker links it to this quest instead of opening it */
  linking: { questId: string; questName: string } | null;
  /** where the active quest is, when it has a spot on this map */
  activeMarker: MapMarker | null;
  onPick: (markerId: string) => void;
  onCancelPick: () => void;
  pins: Pin[];
  onAddPin: (pin: Omit<Pin, "id" | "createdAt">) => void;
  onDeletePin: (id: string) => void;
  editable: boolean;
}

export default function MapView({
  region, config, markers, found, onToggleFound, selected, onSelect,
  linkedIds, linking, onPick, onCancelPick, activeMarker,
  hiddenCategories, hideFound, pins, onAddPin, onDeletePin, editable,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const linkingRef = useRef(linking);
  linkingRef.current = linking;
  /*
   * Two-tap pins: the first tap names the thing, the second opens the drawer.
   * A phone has no hover, so without this the only way to find out what a pin
   * is would be to open it — and at Velen's density that is a lot of opening
   * and closing. previewRef holds the pin currently naming itself.
   */
  const previewRef = useRef<string | null>(null);
  /** read inside the map effect, which does not re-run when the quest changes */
  const activeRef = useRef(activeMarker);
  activeRef.current = activeMarker;
  const markerRefs = useRef(new Map<string, L.Marker>());

  const clearPreview = () => {
    const prev = previewRef.current;
    if (prev) markerRefs.current.get(prev)?.closeTooltip();
    previewRef.current = null;
  };
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState("");
  const [tilesFailed, setTilesFailed] = useState(false);

  /**
   * Rebuilt per region: Velen, Toussaint and Kaer Morhen are flat pixel maps
   * (CRS.Simple) while Skellige and White Orchard use the default geographic
   * CRS, and Leaflet can't change a map's CRS after construction.
   */
  useEffect(() => {
    if (!hostRef.current) return;
    const box = L.latLngBounds(config.sWest, config.nEast);

    /*
     * Stock CRS.Simple transforms latitude to NEGATIVE y, so Leaflet asks for
     * tiles at y = -1..-8 and every request 404s. Shifting the origin by the
     * region's north bound keeps y positive with north still at the top:
     *   y = north - lat   ->  lat=north maps to 0, lat=0 maps to north.
     * The tiles themselves are TMS (row 0 at the bottom), confirmed by
     * stitching zoom 2 and matching Novigrad against the marker data.
     */
    const crs = config.simple
      ? L.Util.extend({}, L.CRS.Simple, {
          transformation: new L.Transformation(1, 0, -1, config.nEast[0]),
        })
      : L.CRS.EPSG3857;

    const map = L.map(hostRef.current, {
      crs,
      minZoom: FULL_TILES,
      maxZoom: config.maxZoom,
      zoomSnap: 0.25,
      attributionControl: false,
      // pinch and double-tap are the gestures on a phone; the +/- buttons
      // were only taking up a corner of the map
      zoomControl: false,
      maxBoundsViscosity: 1,
    });

    setTilesFailed(false);
    const tiles = L.tileLayer(`${TILES}/${config.path}/{z}/{x}/{y}.jpg`, {
      noWrap: true,
      bounds: box,
      minZoom: FULL_TILES,
      maxZoom: config.maxZoom,
    });
    /*
     * The tiles are TMS (y counts up from the south), but Leaflet's own `tms`
     * option flips against `_globalTileRange`, which it can only work out from
     * a bounded CRS. The flat regions use a custom CRS.Simple with no bounds,
     * so there the flip silently did nothing and rows were drawn in reverse —
     * the map looked almost right but never joined up across tile seams.
     * Doing the flip here keeps every region on the same, explicit rule.
     */
    const template = `${TILES}/${config.path}/{z}/{x}/{y}.jpg`;
    tiles.getTileUrl = (coords: L.Coords) => {
      const span = Math.pow(2, coords.z);
      /*
       * Rows to flip against. The geographic maps sit in the usual global
       * grid, but the flat ones publish only their own rows starting at 0, so
       * flipping those against the global grid asks for tiles that were never
       * published — which is why Kaer Morhen and Toussaint came back with
       * holes once the flip was switched on.
       */
      const rows = config.simple
        ? Math.ceil((span * config.nEast[0]) / 256)
        : span;
      return L.Util.template(template, {
        x: coords.x,
        y: rows - 1 - coords.y,
        z: coords.z,
      });
    };

    let errors = 0;
    tiles.on("tileerror", () => {
      if (++errors > 4) setTilesFailed(true);
    });
    tiles.addTo(map);

    /*
     * fitBounds "contains" the map, which on a tall phone frame leaves dead
     * space above and below. Cover instead: take the zoom that fits, then step
     * up until the shorter axis is filled too, capped at the deepest zoom the
     * tiles exist at. A wide region (White Orchard spans 225° by 85°) can't
     * cover a tall frame even at maxZoom, so it still letterboxes — centred,
     * which reads as the map's shape rather than as a bug.
     */
    const fitView = () => {
      // the retry below can land after a region change has torn this map down
      if (!map.getContainer()?.isConnected) return;
      map.invalidateSize();
      const contain = map.getBoundsZoom(box, false);
      const size = map.getSize();
      const nw = map.project(box.getNorthWest(), contain);
      const se = map.project(box.getSouthEast(), contain);
      const scale = Math.max(
        size.x / Math.abs(se.x - nw.x),
        size.y / Math.abs(se.y - nw.y),
      );
      /*
       * The zoom that fills the frame — but never below FULL_TILES. The fork
       * ships an incomplete grid at zoom 2 (White Orchard has no x=2 column
       * there, though zoom 3 covers the whole of its bounds), so zooming out
       * that far shows blank where tiles simply were not published.
       */
      const cover = Math.min(
        Math.max(contain + Math.log2(scale), FULL_TILES),
        config.maxZoom,
      );
      // stop them pinching back out past it, rather than letting the gap appear
      // and snapping back afterwards
      map.setMinZoom(cover);

      // open on the quest when there is one, rather than on the whole region
      const focus = activeRef.current;
      if (focus) {
        map.setView([focus.lat, focus.lng], focusZoom(map, config), { animate: false });
        centredOn.current = focus.id;
        map.setMaxBounds(box);
        return;
      }

      /*
       * Not box.getCenter(): in Mercator the mid-latitude is not the mid-pixel,
       * so on the geographic regions centring there leaves a sliver of empty
       * at one edge. Centre on the projected midpoint instead.
       */
      const a = map.project(box.getNorthWest(), cover);
      const b = map.project(box.getSouthEast(), cover);
      const middle = map.unproject(a.add(b).divideBy(2), cover);
      map.setView(middle, cover, { animate: false });
      // only now is it safe to fence panning: bounds set before this clamp the
      // covered view back off-centre
      // a hard edge rather than an elastic one: with the view always smaller
      // than the map, there is never a reason to pan off it
      map.setMaxBounds(box);
    };
    fitView();
    // the container is often still settling on first paint
    const refit = requestAnimationFrame(fitView);

    // once the map has been panned or zoomed, the view is theirs to keep
    let touched = false;
    map.on("dragstart zoomstart", () => { touched = true; });
    layerRef.current = L.layerGroup().addTo(map);
    routeRef.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (linkingRef.current) return;
      clearPreview();
      onSelectRef.current(null);
      if (!editableRef.current) return;
      setDraft({ lat: +e.latlng.lat.toFixed(3), lng: +e.latlng.lng.toFixed(3) });
      setLabel("");
    });
    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      if (!hostRef.current?.offsetParent) return;
      map.invalidateSize({ animate: false });
      // the box changes height when the active-quest card appears, which
      // leaves the first fit off-centre
      if (!touched) fitView();
    });
    ro.observe(hostRef.current);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(refit);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      routeRef.current = null;
    };
  }, [region, config]);
  void onToggleFound;

  const routeRef = useRef<L.LayerGroup | null>(null);
  const centredOn = useRef<string | null>(null);

  const visible = useMemo(
    () => markers.filter((m) =>
      !hiddenCategories.has(m.category) && !(hideFound && found[m.id])),
    [markers, hiddenCategories, hideFound, found]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markerRefs.current.clear();
    previewRef.current = null;

    const badge = (cat: string, color: string, extra = "", level?: number) =>
      L.divIcon({
        className: `pin-marker ${extra}`,
        html: `<span class="pin-dot" style="--pin:${color}">${
          iconMarkup(CATEGORY_ICON[cat] ?? "point-of-interest", color, 15)}${
          level ? `<i class="pin-lvl">${level}</i>` : ""}</span>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
      });

    for (const m of visible) {
      const isFound = !!found[m.id];
      const color = isFound ? "#6b6253" : colorFor(m.category);
      const topLevel = m.levels?.length ? Math.max(...m.levels) : undefined;
      const parts = [m.name ?? m.category];
      if (m.name) parts.push(m.category);
      if (m.levels?.length) parts.push(`lvl ${m.levels.join(" & ")}`);
      if (m.monsters?.length) parts.push(m.monsters.join(", "));
      if (isFound) parts.push("found");
      const marker = L.marker([m.lat, m.lng], {
        icon: badge(m.category, color,
          [isFound && "found", selected?.id === m.id && "selected",
           linkedIds.has(m.id) && "linked"].filter(Boolean).join(" "),
          topLevel),
        keyboard: false,
      })
        .on("click", () => {
          if (linkingRef.current) { onPickRef.current(m.id); return; }
          if (previewRef.current === m.id) {
            clearPreview();
            onSelect(m);
            return;
          }
          clearPreview();
          previewRef.current = m.id;
          marker.openTooltip();
        })
        .bindTooltip(parts.join(" · "), { direction: "top", offset: [0, -14] })
        .addTo(layer);
      // Leaflet opens tooltips on hover; a phone has none, so drive it from the
      // tap instead and keep both platforms on the same two-tap behaviour
      marker.off("mouseover").off("mouseout");
      markerRefs.current.set(m.id, marker);
    }

    for (const pin of pins.filter((p) => p.map === region)) {
      const color = colorFor(pin.category);
      L.marker([pin.y, pin.x], { icon: badge(pin.category, color, "custom") })
        .bindPopup(`<strong>${escapeHtml(pin.label)}</strong>
          <div class="pin-actions"><button data-act="delete">Delete</button></div>`)
        .on("popupopen", (e) => {
          (e as L.PopupEvent).popup.getElement()
            ?.querySelector('[data-act="delete"]')
            ?.addEventListener("click", () => {
              onDeletePin(pin.id);
              mapRef.current?.closePopup();
            });
        })
        .addTo(layer);
    }
  }, [visible, found, pins, region, selected, onSelect, onDeletePin, linkedIds]);

  useEffect(() => {
    const layer = routeRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!activeMarker) return;

    L.marker([activeMarker.lat, activeMarker.lng], {
      icon: L.divIcon({ className: "route-pin", html: "<span></span>",
                        iconSize: [30, 38], iconAnchor: [15, 38] }),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(layer);
  }, [activeMarker, region]);

  /*
   * Move to the quest when it changes — finishing one should carry the map to
   * the next rather than leave you to find it. Not on every render: once they
   * have panned somewhere, that is where they want to be.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeMarker) return;
    if (centredOn.current === activeMarker.id) return;
    centredOn.current = activeMarker.id;
    map.setView([activeMarker.lat, activeMarker.lng], focusZoom(map, config), {
      animate: true,
    });
  }, [activeMarker, config]);

  return (
    <div className="map-wrap">
      <div ref={hostRef} className="map-host" key={region} />
      {linking && (
        <div className="pick-banner">
          <div>
            <span>Pick a location for</span>
            <strong>{linking.questName}</strong>
          </div>
          <button onClick={onCancelPick}>Cancel</button>
        </div>
      )}
      {tilesFailed && (
        <div className="map-empty">
          <strong>No map backdrop</strong>
          <span>
            witcher3map.com serves its tiles only to its own site. Markers are
            positioned correctly — a map image is all that's missing.
          </span>
        </div>
      )}
      {draft && (
        <div className="pin-form">
          <div className="pin-form-head">New pin <span>{draft.lat}, {draft.lng}</span></div>
          <input autoFocus placeholder="Label" value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onAddPin({
                  map: region, x: draft.lng, y: draft.lat,
                  label: label.trim() || "Pin", category: "Point of interest",
                  questId: null, found: false,
                });
                setDraft(null);
              }
              if (e.key === "Escape") setDraft(null);
            }} />
          <div className="pin-form-actions">
            <button onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
