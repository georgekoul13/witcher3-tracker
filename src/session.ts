/**
 * "Last session" — what you ticked off the last time you sat down to play.
 *
 * The app has no notion of starting or stopping, and asking you to declare it
 * would be one more thing to maintain. So a session is inferred: walk the
 * completion times newest first and stop at the first gap big enough to be a
 * break rather than a pause between two quests.
 */

/** a gap longer than this ends the session */
export const SESSION_GAP_MS = 3 * 60 * 60 * 1000;

export interface DoneEntry {
  /** the progress bucket it came from, e.g. "quests" */
  bucket: string;
  id: string;
  at: number;
}

/** Everything ticked in the most recent run, newest first. */
export function lastSession(
  doneAt: Record<string, number> | undefined,
  gap = SESSION_GAP_MS,
): DoneEntry[] {
  if (!doneAt) return [];

  const all = Object.entries(doneAt)
    .map(([key, at]): DoneEntry => {
      const colon = key.indexOf(":");
      return { bucket: key.slice(0, colon), id: key.slice(colon + 1), at };
    })
    .sort((a, b) => b.at - a.at);

  const run: DoneEntry[] = [];
  for (const entry of all) {
    if (run.length && run[run.length - 1].at - entry.at > gap) break;
    run.push(entry);
  }
  return run;
}
