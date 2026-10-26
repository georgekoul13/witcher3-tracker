import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icons";

/**
 * The pushed list screen: back, optional tabs, "Search anything", and a card
 * per row. Quests use it without tabs because their order is the guide's and
 * must not be re-sorted; everything else arrives in tabs.
 */

export interface RowToggle {
  label: string;
  on: boolean;
  onToggle: () => void;
}

export interface ListRow {
  id: string;
  title: string;
  chips: string[];
  done?: boolean;
  /** the one thing to do next, highlighted apart from the rest */
  active?: boolean;
  onOpen?: () => void;
  /** drag right to complete, drag left to undo; omit to make the row unswipeable */
  onSetDone?: (next: boolean) => void;
  /** ticks shown on the row itself, for things with no detail screen */
  toggles?: RowToggle[];
}

export interface ListTab {
  key: string;
  label: string;
  rows: ListRow[];
}

/** how far you have to drag before it counts */
const THRESHOLD = 88;

/**
 * A row you can drag horizontally to tick it off: right to complete, left to
 * undo one that is already done. Dragging the other way does nothing, so the
 * gesture always means the same thing in each direction.
 *
 * Pointer events rather than touch events, so a mouse works the same as a
 * finger. The axis is locked on the first few pixels of movement — without
 * that, every attempt to scroll the list would nudge rows sideways.
 */
function SwipeRow({ row, index, innerRef }: {
  row: ListRow;
  /** position in the list, so the rows can stagger in rather than all at once */
  index: number;
  innerRef?: (el: HTMLLIElement | null) => void;
}) {
  const [dx, setDx] = useState(0);
  const [sliding, setSliding] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"none" | "x" | "y">("none");

  const canSwipe = !!row.onSetDone;
  const allowed = row.done ? -1 : 1;   // done rows undo leftwards, open rows complete rightwards

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canSwipe || e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = "none";
    setSliding(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const mx = e.clientX - start.current.x;
    const my = e.clientY - start.current.y;

    if (axis.current === "none") {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      // a mostly-vertical first move is a scroll; leave it alone for good
      axis.current = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (axis.current === "x") {
        setSliding(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        start.current = null;
        return;
      }
    }
    // only the meaningful direction moves, and it resists past the threshold
    const raw = allowed > 0 ? Math.max(0, mx) : Math.min(0, mx);
    const over = Math.max(0, Math.abs(raw) - THRESHOLD);
    setDx(Math.sign(raw) * (Math.abs(raw) - over * 0.65));
  };

  const finish = () => {
    if (axis.current === "x" && Math.abs(dx) >= THRESHOLD) row.onSetDone?.(!row.done);
    start.current = null;
    axis.current = "none";
    setSliding(false);
    setDx(0);
  };

  const armed = Math.abs(dx) >= THRESHOLD;

  const state = row.active ? "active" : row.done ? "done" : "";

  return (
    <li className={`rowcard-wrap ${state}`} ref={innerRef}
      /* only the first screenful staggers; past that it would just be a delay
         before anything appears */
      style={index < 10 ? { "--i": index } as React.CSSProperties : undefined}>
      {canSwipe && (
        <span className={`rowcard-bg ${row.done ? "undo" : ""} ${armed ? "armed" : ""}`}>
          <Icon name={row.done ? "close" : "check"} size={18} />
          {row.done ? "Not done" : "Done"}
        </span>
      )}

      <div
        className={`rowcard ${state} ${sliding ? "sliding" : ""}`}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        {row.onOpen
          ? (
            <button className="rowcard-main"
              onClick={() => { if (axis.current !== "x") row.onOpen?.(); }}>
              <strong>{row.title}</strong>
            </button>
          )
          : <strong className="rowcard-main">{row.title}</strong>}

        <span className="rowcard-chips">
          {row.chips.map((c, i) => <i key={i}>{c}</i>)}
        </span>

        {row.toggles && row.toggles.length > 0 && (
          <span className="rowcard-toggles">
            {row.toggles.map((t) => (
              <button key={t.label} onClick={t.onToggle}
                className={`rowtick ${t.on ? "on" : ""}`}
                aria-pressed={t.on}>
                <Icon name="check" size={14} />
                {t.label}
              </button>
            ))}
          </span>
        )}
      </div>
    </li>
  );
}

interface Props {
  title: string;
  tabs: ListTab[];
  onBack: () => void;
  /** a short list with nothing to find does not need a search field */
  search?: boolean;
}

export default function ListPage({ title, tabs, onBack, search = true }: Props) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const [q, setQ] = useState("");

  const activeRef = useRef<HTMLLIElement | null>(null);

  const rows = tabs.find((t) => t.key === active)?.rows ?? [];
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) => r.title.toLowerCase().includes(needle)
        || r.chips.some((c) => c.toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  /*
   * Open on the thing to do next rather than at the top of 458 rows. Only
   * while the list is untouched: once they have searched or switched tab they
   * are looking for something else.
   */
  useEffect(() => {
    if (q) return;
    activeRef.current?.scrollIntoView({ block: "center" });
  }, [active, q]);

  return (
    <div className="page listpage">
      <header className="track-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="chevron-right" size={22} className="flip" />
        </button>
        <h1 className="page-title">{title}</h1>
      </header>

      {tabs.length > 1 && (
        <div className="tabstrip" role="tablist" aria-label={title}>
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={t.key === active}
              className={`tab ${t.key === active ? "on" : ""}`}
              onClick={() => setActive(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {search && (
        /* the dock is what sticks: the field itself is inset 24px, and a bare
           sticky field would let rows scroll through the gutters beside it */
        <div className="search-dock">
          <label className="searchbox">
            <Icon name="search" size={20} />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search anything" aria-label={`Search ${title}`} />
          </label>
        </div>
      )}

      <ul className="rowcards">
        {shown.map((r, i) => (
          <SwipeRow key={r.id} row={r} index={i}
            innerRef={r.active ? (el) => { activeRef.current = el; } : undefined} />
        ))}
        {shown.length === 0 && (
          <li className="rowcards-empty">Nothing matches “{q}”.</li>
        )}
      </ul>
    </div>
  );
}
