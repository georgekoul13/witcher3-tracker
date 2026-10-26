import { useCallback, useEffect, useState } from "react";

const OPEN_KEY = "w3tracker.sections.v1";
const WIDTH_KEY = "w3tracker.sidebarWidth.v1";
export const MIN_WIDTH = 340;
export const MAX_WIDTH = 900;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the choice just won't persist */
  }
}

/** Which sections are expanded. Several may be open at once. */
export function useOpenSections(initial: string[]) {
  const [open, setOpen] = useState<string[]>(() => read(OPEN_KEY, initial));
  useEffect(() => write(OPEN_KEY, open), [open]);

  const toggle = useCallback((key: string) => {
    setOpen((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }, []);

  return { open, toggle };
}

export function useSidebarWidth() {
  const [width, setWidth] = useState<number>(() => read(WIDTH_KEY, 460));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, innerWidth - e.clientX));
      setWidth(next);
    };
    const onUp = () => setDragging(false);
    addEventListener("mousemove", onMove);
    addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      removeEventListener("mousemove", onMove);
      removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  useEffect(() => write(WIDTH_KEY, width), [width]);

  return { width, dragging, startDrag: () => setDragging(true) };
}
