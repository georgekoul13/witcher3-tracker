/**
 * Icons are Lucide (ISC), imported as raw SVG so one source serves both React
 * and the Leaflet markers, which need markup strings rather than components.
 */
import store from "lucide-static/icons/store.svg?raw";
import bedDouble from "lucide-static/icons/bed-double.svg?raw";
import anvil from "lucide-static/icons/anvil.svg?raw";
import hammer from "lucide-static/icons/hammer.svg?raw";
import shield from "lucide-static/icons/shield.svg?raw";
import leaf from "lucide-static/icons/leaf.svg?raw";
import scissors from "lucide-static/icons/scissors.svg?raw";
import signpost from "lucide-static/icons/signpost.svg?raw";
import doorOpen from "lucide-static/icons/door-open.svg?raw";
import anchor from "lucide-static/icons/anchor.svg?raw";
import shieldAlert from "lucide-static/icons/shield-alert.svg?raw";
import gem from "lucide-static/icons/gem.svg?raw";
import waves from "lucide-static/icons/waves.svg?raw";
import swords from "lucide-static/icons/swords.svg?raw";
import tent from "lucide-static/icons/tent.svg?raw";
import egg from "lucide-static/icons/egg.svg?raw";
import skull from "lucide-static/icons/skull.svg?raw";
import grape from "lucide-static/icons/grape.svg?raw";
import castle from "lucide-static/icons/castle.svg?raw";
import scrollText from "lucide-static/icons/scroll-text.svg?raw";
import disc3 from "lucide-static/icons/disc-3.svg?raw";
import flaskConical from "lucide-static/icons/flask-conical.svg?raw";
import circleHelp from "lucide-static/icons/circle-help.svg?raw";
import house from "lucide-static/icons/house.svg?raw";
import sparkles from "lucide-static/icons/sparkles.svg?raw";
import clipboardList from "lucide-static/icons/clipboard-list.svg?raw";
import handHelping from "lucide-static/icons/hand-helping.svg?raw";
import baby from "lucide-static/icons/baby.svg?raw";
import heart from "lucide-static/icons/heart.svg?raw";
import flame from "lucide-static/icons/flame.svg?raw";
import spade from "lucide-static/icons/spade.svg?raw";
import diamond from "lucide-static/icons/diamond.svg?raw";
import star from "lucide-static/icons/star.svg?raw";
import users from "lucide-static/icons/users.svg?raw";
import dices from "lucide-static/icons/dices.svg?raw";
import compass from "lucide-static/icons/compass.svg?raw";
import mapIcon from "lucide-static/icons/map.svg?raw";
import listChecks from "lucide-static/icons/list-checks.svg?raw";
import trophy from "lucide-static/icons/trophy.svg?raw";
import settings from "lucide-static/icons/settings.svg?raw";
import search from "lucide-static/icons/search.svg?raw";
import x from "lucide-static/icons/x.svg?raw";
import chevronRight from "lucide-static/icons/chevron-right.svg?raw";
import chevronDown from "lucide-static/icons/chevron-down.svg?raw";
import funnel from "lucide-static/icons/funnel.svg?raw";
import check from "lucide-static/icons/check.svg?raw";
import plus from "lucide-static/icons/plus.svg?raw";
import mapPin from "lucide-static/icons/map-pin.svg?raw";
import link2Off from "lucide-static/icons/link-2-off.svg?raw";
import externalLink from "lucide-static/icons/external-link.svg?raw";
import download from "lucide-static/icons/download.svg?raw";
import upload from "lucide-static/icons/upload.svg?raw";
import triangleAlert from "lucide-static/icons/triangle-alert.svg?raw";
import info from "lucide-static/icons/info.svg?raw";
import gripHorizontal from "lucide-static/icons/grip-horizontal.svg?raw";
import arrowUpDown from "lucide-static/icons/arrow-up-down.svg?raw";

const RAW = {
  // map markers — one per category
  "merchant": store,
  "innkeep": bedDouble,
  "blacksmith": anvil,
  "armourer": shield,
  "herbalist": leaf,
  "barber": scissors,
  "signpost": signpost,
  "entrance": doorOpen,
  "harbor": anchor,
  "guarded-treasure": shieldAlert,
  "hidden-treasure": gem,
  "smugglers-cache": waves,
  "spoils-of-war": swords,
  "bandit-camp": tent,
  "monster-nest": egg,
  "monster-den": skull,
  "vineyard-infestation": grape,
  "hanse-base": castle,
  "contract": scrollText,
  "grindstone": disc3,
  "armourers-table": hammer,
  "alchemy-supplies": flaskConical,
  "point-of-interest": circleHelp,
  "abandoned-site": house,
  "place-of-power": sparkles,
  "notice-board": clipboardList,
  "person-in-distress": handHelping,
  "child": baby,
  "brothel": heart,
  "signal-fire": flame,
  "gwent-card": spade,
  "side-quest": diamond,

  // quest types
  "quest-main": star,
  "quest-side": diamond,
  "quest-contract": scrollText,
  "quest-treasure-hunt": gem,
  "quest-scavenger-hunt": swords,
  "quest-chance-encounter": users,
  "quest-gwent-race": dices,

  // navigation
  "nav-now": compass,
  "nav-map": mapIcon,
  "nav-quests": listChecks,
  "nav-collect": trophy,
  "nav-settings": settings,

  // ui
  "search": search,
  "close": x,
  "chevron-right": chevronRight,
  "chevron-down": chevronDown,
  "filter": funnel,
  "check": check,
  "plus": plus,
  "location-pin": mapPin,
  "unlink": link2Off,
  "external-link": externalLink,
  "export": download,
  "import": upload,
  "warning": triangleAlert,
  "info": info,
  "switch-map": arrowUpDown,
  "drag-handle": gripHorizontal,
} as const;

export type IconName = keyof typeof RAW;

/** Lucide ships a full <svg> wrapper; we want only what's inside it. */
const innerCache = new Map<string, string>();
/** data can name a category we have no glyph for; that must not blank the app */
const FALLBACK: IconName = "point-of-interest";
function inner(name: IconName): string {
  let v = innerCache.get(name);
  if (v === undefined) {
    v = (RAW[name] ?? RAW[FALLBACK])
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/^[\s\S]*?<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .trim();
    innerCache.set(name, v);
  }
  return v;
}

export default function Icon({
  name, size = 16, className, strokeWidth = 1.9,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden focusable="false"
      dangerouslySetInnerHTML={{ __html: inner(name) }}
    />
  );
}

/** Leaflet divIcons take markup, not components. */
export function iconMarkup(name: IconName, color: string, size = 15) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="${color}" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round">${inner(name)}</svg>`;
}
