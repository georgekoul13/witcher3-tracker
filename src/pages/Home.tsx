import { useState } from "react";
import Icon, { type IconName } from "../components/Icons";
import type { LastPlace } from "../types";
import type { Totals } from "../progress";
import Menu, { type MenuItem } from "../components/Menu";

/**
 * The landing screen: who you are, where you left off, how far along you are,
 * and one button into the map. Everything here is a glance — the thinking
 * happens on the tracking screen.
 */

export interface MarkerStat {
  key: string;
  label: string;
  icon: IconName;
  done: number;
  total: number;
}

const CORE_ICON: Record<string, IconName> = {
  quests: "nav-quests",
  gear: "quest-scavenger-hunt",
  trophies: "nav-collect",
  gwent: "quest-gwent-race",
};

const CORE_LABEL: Record<string, string> = {
  quests: "Quests",
  gear: "Gear",
  trophies: "Trophies",
  gwent: "Gwent",
};

/** the design's reading order, which is not the order totals computes them in */
const CORE_ORDER = ["quests", "gear", "trophies", "gwent"];

/** zone names are shouted in the spreadsheet; the design is not */
function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s/&-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

function StatCard({ label, icon, done, total }: Omit<MarkerStat, "key">) {
  return (
    <li className="stat-card">
      <span className="stat-card-head">
        <Icon name={icon} size={16} />
        {label}
      </span>
      <span className="stat-card-num">
        <strong>{done}</strong>
        <i>/{total}</i>
      </span>
    </li>
  );
}

interface Props {
  totals: Totals;
  markerStats: MarkerStat[];
  lastPlace?: LastPlace;
  fallbackPlace: string;
  lastSessionCount: number;
  behind: number;
  onStart: () => void;
  onOpenRecent: () => void;
  onOpenQuests: () => void;
  /** export / import, hung off the avatar */
  menu: MenuItem[];
}

export default function Home({
  totals, markerStats, lastPlace, fallbackPlace, lastSessionCount, behind,
  onStart, onOpenRecent, onOpenQuests, menu,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pct = Math.round(totals.pct * 100);
  const core = totals.categories
    .filter((c) => c.core)
    .sort((a, b) => CORE_ORDER.indexOf(a.key) - CORE_ORDER.indexOf(b.key));

  return (
    <div className="page home">
      <div className="home-scroll">
        <div className="avatar-wrap">
          <button className="avatar" aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)} aria-label="Backup">
            <Icon name="nav-settings" size={22} />
          </button>
          {menuOpen && <Menu items={menu} onClose={() => setMenuOpen(false)} />}
        </div>

        <p className="home-last">
          <Icon name="location-pin" size={15} />
          LAST VISIT
        </p>
        <h1 className="home-place">
          {lastPlace?.name ?? titleCase(fallbackPlace)}
        </h1>

        {/* what you got through last time you played, and anything you have
            left behind; both open a list rather than explaining themselves */}
        <div className="warn-row">
          <button className="warn-pill" onClick={onOpenRecent}>
            <strong>{lastSessionCount}</strong> done last session
          </button>
          {behind > 0 && (
            <button className="warn-pill danger" onClick={onOpenQuests}>
              <strong>{behind}</strong> behind you
            </button>
          )}
        </div>

        <h2 className="section-label">INSIGHTS</h2>

        <div className="total-card">
          <div className="total-card-head">
            <span>Total progress</span>
            <strong>{String(pct).padStart(2, "0")}%</strong>
          </div>
          <div className="bar">
            {/* never thinner than the track is tall, so 0% still reads as a dot */}
            <i style={{ width: `max(var(--bar-h), ${totals.pct * 100}%)` }} />
          </div>
        </div>

        <ul className="stat-grid">
          {core.map((c) => (
            <StatCard
              key={c.key}
              label={CORE_LABEL[c.key] ?? c.label}
              icon={CORE_ICON[c.key] ?? "nav-quests"}
              done={c.done}
              total={c.total}
            />
          ))}
          {markerStats.map((m) => (
            <StatCard key={m.key} label={m.label} icon={m.icon}
              done={m.done} total={m.total} />
          ))}
        </ul>
      </div>

      <button className="start-btn" onClick={onStart}>Start tracking</button>
    </div>
  );
}
