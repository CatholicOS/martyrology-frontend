import { describe, it, expect } from "vitest";
import { apparatus, count, only } from "@/lib/apparatus";
import type { MonthOut } from "@/lib/types";

const el = (id: string, extra = {}) => ({
  id, entry: null, asterisk: false, unnumbered: false, anchor_day: "", text: `Text of ${id}.`, ...extra,
});
const month = (mm: number, days: Record<string, ReturnType<typeof el>[]>): MonthOut => ({
  metadata: { edition: "ed", month: mm },
  days: Object.fromEntries(Object.entries(days).map(([d, elogia]) => [d, { titulus: null, elogia, conclusio: null }])),
});
const erratum = { kind: "replace" as const, printed: "Text", corrected: "Textus", ref: "1.1", entry: "1.1. Text, Textus." };

describe("apparatus", () => {
  const notes = {
    "mr:0102-b": { note: "On the eulogy." },
    "mr:0101-a": { editions: { ed: "On this edition.", other: "Not here." } },
    "mr:0301-z": { note: "Not printed by this edition." },
  };
  const misprints = (edition: string, id: string) =>
    id === "mr:0102-b" ? [{ id, edition, printed: "Text", intended: "Textus" }] : [];
  const months = [
    month(2, { "01": [el("mr:0201-c", { errata: [erratum] })] }),
    month(1, { "02": [el("mr:0102-b"), el("mr:0102-plain")], "01": [el("mr:0101-a")] }),
  ];

  it("lists the eulogies with a note, misprint or erratum, in printed order", () => {
    const out = apparatus("ed", months, notes, misprints);
    expect(out.map((e) => [e.id, e.mm, e.dd])).toEqual([["mr:0101-a", 1, 1], ["mr:0102-b", 1, 2], ["mr:0201-c", 2, 1]]);
    expect(out[0].notes).toEqual(["On this edition."]);
    expect(out[1].notes).toEqual(["On the eulogy."]);
    expect(out[1].misprints).toHaveLength(1);
    expect(out[2].errata).toEqual([erratum]);
  });

  it("counts each kind and filters by kind", () => {
    const out = apparatus("ed", months, notes, misprints);
    expect([count(out, "notes"), count(out, "misprints"), count(out, "errata")]).toEqual([2, 1, 1]);
    expect(only(out, new Set(["errata"])).map((e) => e.id)).toEqual(["mr:0201-c"]);
  });
});
