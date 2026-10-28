import { dayPath, pad2, parseDay, type Day } from "@/lib/calendar";

/**
 * What a view opened from the reader (the notes, the index of places, the index of names) carries in
 * its address to lead back to it: the day the reader was on, and the edition it was compared with.
 */
export type ReaderReturn = { day: Day | null; with: string | null };

export const NO_RETURN: ReaderReturn = { day: null, with: null };

/** A view's query: the `extra` parameters first (a null one is left out), then `?day=MM-DD&with=`; "" when empty. */
export function returnQuery(r: ReaderReturn, extra: Record<string, string | null> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  if (r.day) q.set("day", `${pad2(r.day.mm)}-${pad2(r.day.dd)}`);
  if (r.with) q.set("with", r.with);
  const s = q.toString();
  return s ? `?${s}` : "";
}

type Params = { [key: string]: string | string[] | undefined };

/** The `?day=` and `?with=` of a view of `edition`, each dropped when it is not a single valid value. */
export function parseReturn(params: Params | undefined, edition: string): ReaderReturn {
  const d = typeof params?.day === "string" ? /^(\d{2})-(\d{2})$/.exec(params.day) : null;
  const w = params?.with;
  return { day: d ? parseDay(d[1], d[2]) : null, with: typeof w === "string" && w && w !== edition ? w : null };
}

/** The reader's page to go back to: the day left, with its comparison; with no day, today's page, with it too. */
export function readerHref(edition: string, r: ReaderReturn): string {
  if (r.day) return dayPath(edition, r.day, r.with);
  return `/read/${encodeURIComponent(edition)}${r.with ? `?with=${encodeURIComponent(r.with)}` : ""}`;
}
