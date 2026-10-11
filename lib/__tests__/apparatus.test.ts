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

  it("keeps each eulogy's number and asterisk as this edition prints them", () => {
    const ms = [month(1, { "04": [el("mr:0104-abrunculus", { entry: 2, asterisk: true })] })];
    const out = apparatus("ed", ms, { "mr:0104-abrunculus": { note: "Entry 2* in the Latin." } }, () => []);
    expect(out[0]).toMatchObject({ entry: 2, asterisk: true, unnumbered: false });
  });

  it("counts each kind and filters by kind", () => {
    const out = apparatus("ed", months, notes, misprints);
    expect([count(out, "notes"), count(out, "misprints"), count(out, "errata")]).toEqual([2, 1, 1]);
    expect(only(out, new Set(["errata"])).map((e) => e.id)).toEqual(["mr:0201-c"]);
  });

  it("lists a eulogy's footnote misprints with the footnote's printed mark", () => {
    const footnotes = [{ mark: "31", after: null, text: "Uno." }, { mark: "32", after: null, text: "Due e maria." }];
    const ms = [month(8, { "01": [el("mr:0801-a", { footnotes }), el("mr:0801-b")] })];
    const fm = (edition: string, id: string) => [
      { id, edition, printed: "Text", intended: "Textus" },
      { id, edition, printed: "e maria", intended: "e Maria", footnote: 2 },
    ];
    const out = apparatus("ed", ms, {}, fm);
    expect(out[0].misprints).toEqual([
      { id: "mr:0801-a", edition: "ed", printed: "Text", intended: "Textus" },
      { id: "mr:0801-a", edition: "ed", printed: "e maria", intended: "e Maria", footnote: 2, mark: "32" },
    ]);
    // A footnote the month does not serve is named by its number as counted.
    expect(out[1].misprints[1].mark).toBe("2");
  });
});
