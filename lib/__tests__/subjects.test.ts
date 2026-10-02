import { describe, it, expect } from "vitest";
import { findSubject, subjectOptions } from "@/lib/subjects";
import type { CatalogEntryOut } from "@/lib/types";

const entry = (id: string, subject: string | null, day_printed: string | null, entry: number | null = 1): CatalogEntryOut => ({
  id, subject, anchor_day: day_printed ?? "01-01", deprecated: false, present: day_printed !== null, day_printed, entry,
});

describe("subjectOptions", () => {
  it("lists the eulogies the edition prints, by subject then day, with the printed day as a hint", () => {
    const opts = subjectOptions([
      entry("mr:1227-ioannes", "Sanctus Ioannes", "12-27"),
      entry("mr:0101-basilius", "Sanctus Basilius", "01-01"),
      entry("mr:0506-ioannes", "Sanctus Ioannes", "05-06"),
      entry("mr:0101-martina", "Sancta Martina", null),
      entry("mr:0102-x", null, "01-02"),
    ]);
    expect(opts).toEqual([
      { value: "Sanctus Basilius — 1 January", id: "mr:0101-basilius", day: { mm: 1, dd: 1 } },
      { value: "Sanctus Ioannes — 6 May", id: "mr:0506-ioannes", day: { mm: 5, dd: 6 } },
      { value: "Sanctus Ioannes — 27 December", id: "mr:1227-ioannes", day: { mm: 12, dd: 27 } },
    ]);
  });

  it("tells apart two eulogies of the same subject on the same day by their number", () => {
    const opts = subjectOptions([
      entry("mr:0310-a", "Sancti Martyres", "03-10", 4),
      entry("mr:0310-b", "Sancti Martyres", "03-10", 2),
    ]);
    expect(opts.map((o) => o.value)).toEqual(["Sancti Martyres — 10 March, n. 2", "Sancti Martyres — 10 March, n. 4"]);
  });

  it("falls back to the id when such twins are unnumbered, so each stays pickable", () => {
    const opts = subjectOptions([
      entry("mr:0310-b", "Sancti Martyres", "03-10", null),
      entry("mr:0310-a", "Sancti Martyres", "03-10", null),
    ]);
    expect(new Set(opts.map((o) => o.value)).size).toBe(2);
    expect(opts.map((o) => o.value).sort()).toEqual(["Sancti Martyres — 10 March, mr:0310-a", "Sancti Martyres — 10 March, mr:0310-b"]);
  });
});

describe("findSubject", () => {
  const opts = subjectOptions([
    entry("mr:1227-ioannes", "Sanctus Ioannes", "12-27"),
    entry("mr:0506-ioannes", "Sanctus Ioannes", "05-06"),
    entry("mr:0101-basilius", "Sanctus Basilius", "01-01"),
  ]);

  it("matches an option exactly", () => {
    expect(findSubject(opts, "Sanctus Ioannes — 6 May")?.id).toBe("mr:0506-ioannes");
  });

  it("takes typed text when it fits exactly one option, ignoring case", () => {
    expect(findSubject(opts, "basil")?.id).toBe("mr:0101-basilius");
    expect(findSubject(opts, "ioannes")).toBeNull();
    expect(findSubject(opts, "  ")).toBeNull();
  });
});
