import type { CatalogEntryOut } from "@/lib/types";
import type { RegistrySnapshot } from "@/lib/snapshot";

export interface CompareRow { id: string; status: "both" | "a-only" | "b-only"; color: "red" | "green" | "none"; crossDay: boolean; subject: string | null; country: string | null; anchorDay: string; entry: number | null; }
export interface CompareDayGroup { day: string; rows: CompareRow[]; counts: { both: number; aOnly: number; bOnly: number; red: number; green: number }; }

export function buildComparison(a: CatalogEntryOut[], b: CatalogEntryOut[], snapshot: RegistrySnapshot): CompareDayGroup[] {
  const present = (xs: CatalogEntryOut[]) => xs.filter((e) => e.present !== false && e.day_printed);
  const byId = (xs: CatalogEntryOut[]) => new Map(xs.map((e) => [e.id, e]));
  const A = byId(present(a)), B = byId(present(b));
  const days = new Map<string, CompareRow[]>();
  const push = (day: string, row: CompareRow) => { if (!days.has(day)) days.set(day, []); days.get(day)!.push(row); };
  const color = (id: string, e: CatalogEntryOut): "red" | "green" => ((snapshot[id]?.deprecated ?? e.deprecated) ? "red" : "green");
  const row = (e: CatalogEntryOut, status: CompareRow["status"], col: CompareRow["color"]): CompareRow => ({
    id: e.id, status, color: col, crossDay: e.anchor_day !== e.day_printed,
    subject: e.subject ?? snapshot[e.id]?.subject.la ?? null, country: snapshot[e.id]?.country ?? null,
    anchorDay: e.anchor_day, entry: e.entry ?? null,
  });
  const ids = new Set([...A.keys(), ...B.keys()]);
  for (const id of ids) {
    const ea = A.get(id), eb = B.get(id);
    if (ea && eb && ea.day_printed === eb.day_printed) push(ea.day_printed!, row(ea, "both", "none"));
    else {
      if (ea) push(ea.day_printed!, row(ea, "a-only", color(id, ea)));
      if (eb) push(eb.day_printed!, row(eb, "b-only", color(id, eb)));
    }
  }
  return [...days.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([day, rows]) => {
    rows.sort((r1, r2) => (r1.entry ?? Infinity) - (r2.entry ?? Infinity) || r1.id.localeCompare(r2.id));
    const counts = { both: 0, aOnly: 0, bOnly: 0, red: 0, green: 0 };
    for (const r of rows) { if (r.status === "both") counts.both++; else if (r.status === "a-only") counts.aOnly++; else counts.bOnly++; if (r.color === "red") counts.red++; if (r.color === "green") counts.green++; }
    return { day, rows, counts };
  });
}
