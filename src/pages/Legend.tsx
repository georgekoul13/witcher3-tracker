import Icon from "../components/Icons";
import { CATEGORY_ICON, colorFor } from "../components/MapView";

/** The info button: what every pin on the map means. */
export default function Legend({
  categories, onBack,
}: {
  categories: [string, number][];
  onBack: () => void;
}) {
  return (
    <div className="page listpage">
      <header className="track-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="chevron-right" size={22} className="flip" />
        </button>
        <h1 className="page-title">What the pins mean</h1>
      </header>

      <p className="legend-sub">
        Every marker type on this map, and how many of each are here.
      </p>

      <ul className="legend-list">
        {categories.map(([cat, n]) => (
          <li key={cat}>
            <span className="legend-icon" style={{ color: colorFor(cat) }}>
              <Icon name={CATEGORY_ICON[cat] ?? "point-of-interest"} size={18} />
            </span>
            <strong>{cat}</strong>
            <i>{n}</i>
          </li>
        ))}
      </ul>
    </div>
  );
}
