import { useEffect, useRef } from "react";
import Icon, { type IconName } from "./Icons";

export interface MenuItem {
  label: string;
  icon: IconName;
  note?: string;
  onPick: () => void;
}

/**
 * A small popover hung off whatever opened it, styled like the map's pin
 * tooltips. Two actions do not need a screen of their own.
 */
export default function Menu({
  items, onClose,
}: {
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // defer, or the tap that opened it closes it again
    const t = setTimeout(() => document.addEventListener("pointerdown", away), 0);
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);

  return (
    <div className="menu" ref={ref} role="menu">
      {items.map((item) => (
        <button key={item.label} role="menuitem" className="menu-item"
          onClick={() => { item.onPick(); onClose(); }}>
          <Icon name={item.icon} size={18} />
          <span>
            {item.label}
            {item.note && <i>{item.note}</i>}
          </span>
        </button>
      ))}
    </div>
  );
}
