import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Bottom sheet: drag the handle down to dismiss, tap the scrim, or press Esc.
 * On desktop it docks as a floating card in the map's bottom-left corner.
 */
export default function Sheet({ open, onClose, children }: Props) {
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setDrag(0);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const begin = (y: number) => { startY.current = y; };
  const move = (y: number) => {
    if (startY.current === null) return;
    setDrag(Math.max(0, y - startY.current));
  };
  const end = () => {
    if (drag > 110) onClose();
    startY.current = null;
    setDrag(0);
  };

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        className="sheet"
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
      >
        <div
          className="sheet-grab"
          onPointerDown={(e) => {
            begin(e.clientY);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => move(e.clientY)}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <span />
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}
