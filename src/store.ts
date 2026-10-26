import { useCallback, useEffect, useState } from "react";
import type { Bucket, LastPlace, Progress } from "./types";

const KEY = "w3tracker.progress.v1";
const EXPORT_KEY = "w3tracker.lastExport.v1";

export const emptyProgress: Progress = {
  quests: {}, details: {}, trophies: {}, gwent: {},
  scavFound: {}, scavCrafted: {}, alchemy: {}, markers: {}, pins: [], links: {},
};

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress;
    return { ...emptyProgress, ...JSON.parse(raw) };
  } catch {
    return emptyProgress;
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
    } catch {
      /* storage unavailable — progress stays in memory for this session */
    }
  }, [progress]);

  const toggle = useCallback(
    (bucket: Bucket, id: string) =>
      setProgress((p) => {
        const next = !p[bucket][id];
        const doneAt = { ...(p.doneAt ?? {}) };
        // only ticking something counts as doing it; unticking is a correction
        if (next) doneAt[`${bucket}:${id}`] = Date.now();
        else delete doneAt[`${bucket}:${id}`];
        return { ...p, [bucket]: { ...p[bucket], [id]: next }, doneAt };
      }),
    [],
  );

  /**
   * A marker id links the quest; "" records that you unlinked it, which has to
   * persist so a seeded link stays gone; null forgets the choice entirely and
   * lets any seeded link apply again.
   */
  const setLink = useCallback((questId: string, markerId: string | null) =>
    setProgress((p) => {
      const links = { ...p.links };
      if (markerId === null) delete links[questId];
      else links[questId] = markerId;
      return { ...p, links };
    }), []);

  const setLastPlace = useCallback((place: LastPlace) =>
    setProgress((p) => ({ ...p, lastPlace: place })), []);

  const setBucket = useCallback(
    (bucket: Bucket, values: Record<string, boolean>) =>
      setProgress((p) => ({ ...p, [bucket]: values })),
    [],
  );

  return { progress, setProgress, toggle, setBucket, setLink, setLastPlace };
}

/**
 * Ask Android to treat this app's storage as persistent.
 *
 * Progress lives in localStorage, which a browser is free to evict when the
 * device is short of space. Granted, it stops being evictable — it then only
 * goes if the app is uninstalled or site data is cleared by hand. Chrome
 * grants it for an installed PWA without prompting; in a plain tab it may
 * refuse, which is a reason to install rather than a failure.
 */
export async function keepStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageState(): Promise<{
  persisted: boolean; usedKb: number | null;
}> {
  try {
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    const est = await navigator.storage?.estimate?.();
    return { persisted, usedKb: est?.usage ? Math.round(est.usage / 1024) : null };
  } catch {
    return { persisted: false, usedKb: null };
  }
}

export function lastExportAt(): number | null {
  try {
    const raw = localStorage.getItem(EXPORT_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function exportProgress(progress: Progress) {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `witcher3-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  try { localStorage.setItem(EXPORT_KEY, String(Date.now())); } catch { /* ignore */ }
}

export async function importProgress(file: File): Promise<Progress> {
  const parsed = JSON.parse(await file.text());
  return { ...emptyProgress, ...parsed };
}
