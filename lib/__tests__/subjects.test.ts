import { createFormatter } from "use-intl";
import { describe, it, expect } from "vitest";
import { findSubject, matchSubjects, subjectFor, subjectOptions } from "@/lib/subjects";
import type { CatalogEntryOut } from "@/lib/types";

const entry = (id: string, subject: string | null, day_printed: string | null, entry: number | null = 1): CatalogEntryOut => ({
  id, subject, anchor_day: day_printed ?? "01-01", deprecated: false, present: day_printed !== null, day_printed, entry,
});

const format = createFormatter({ locale: "en" });

describe("subjectOptions", () => {
  it("lists the eulogies the edition prints, by subject then day, with the printed day as a hint", () => {
    const opts = subjectOptions([
      entry("mr:1227-ioannes", "Sanctus Ioannes", "12-27"),
      entry("mr:0101-basilius", "Sanctus Basilius", "01-01"),
      entry("mr:0506-ioannes", "Sanctus Ioannes", "05-06"),
      entry("mr:0101-martina", "Sancta Martina", null),
      entry("mr:0102-x", null, "01-02"),
    ], format);
    expect(opts).toEqual([
      { value: "Sanctus Basilius — 1 January", id: "mr:0101-basilius", day: { mm: 1, dd: 1 } },
      { value: "Sanctus Ioannes — 6 May", id: "mr:0506-ioannes", day: { mm: 5, dd: 6 } },
      { value: "Sanctus Ioannes — 27 December", id: "mr:1227-ioannes", day: { mm: 12, dd: 27 } },
    ]);
  });

  it("names the month in the interface language", () => {
    const opts = subjectOptions([entry("mr:1227-ioannes", "Sanctus Ioannes", "12-27")], createFormatter({ locale: "it" }));
    expect(opts[0].value).toBe("Sanctus Ioannes — 27 dicembre");
  });

  it("labels each eulogy with the subject in the interface language", () => {
    const registry: Record<string, { la: string; it?: string; en: string }> = {
      "mr:1227-ioannes": { la: "Sanctus Ioannes", it: "San Giovanni", en: "Saint John" },
    };
    const subjectOf = (loc: string) => (id: string, own: string) => subjectFor(registry[id], loc, own);
    const cat = [entry("mr:1227-ioannes", "Saint John the Apostle", "12-27")];
    expect(subjectOptions(cat, createFormatter({ locale: "it" }), subjectOf("it"))[0].value).toBe("San Giovanni — 27 dicembre");
    expect(subjectOptions(cat, createFormatter({ locale: "fr" }), subjectOf("fr"))[0].value).toBe("Saint John — 27 décembre");
  });

  it("keeps the subject's other languages for the search, apart from the label", () => {
    const registry: Record<string, { la: string; it: string; en: string }> = {
      "mr:1214-ioannes-a-cruce": { la: "Sanctus Ioannes a Cruce", it: "San Giovanni della Croce", en: "Saint John of the Cross" },
    };
    const cat = [entry("mr:1214-ioannes-a-cruce", "Sanctus Ioannes a Cruce", "12-14")];
    const opts = subjectOptions(
      cat,
      format,
      (id, own) => subjectFor(registry[id], "en", own),
      (id, own) => [own, registry[id].la, registry[id].it, registry[id].en],
    );
    expect(opts).toEqual([{
      value: "Saint John of the Cross — 14 December",
      id: "mr:1214-ioannes-a-cruce",
      day: { mm: 12, dd: 14 },
      also: ["Sanctus Ioannes a Cruce", "San Giovanni della Croce"],
    }]);
    // Without the other languages, nothing is added.
    expect(subjectOptions(cat, format)[0]).not.toHaveProperty("also");
  });

  it("tells apart two eulogies of the same subject on the same day by their number", () => {
    const opts = subjectOptions([
      entry("mr:0310-a", "Sancti Martyres", "03-10", 4),
      entry("mr:0310-b", "Sancti Martyres", "03-10", 2),
    ], format);
    expect(opts.map((o) => o.value)).toEqual(["Sancti Martyres — 10 March, n. 2", "Sancti Martyres — 10 March, n. 4"]);
  });

  it("falls back to the id when such twins are unnumbered, so each stays pickable", () => {
    const opts = subjectOptions([
      entry("mr:0310-b", "Sancti Martyres", "03-10", null),
      entry("mr:0310-a", "Sancti Martyres", "03-10", null),
    ], format);
    expect(new Set(opts.map((o) => o.value)).size).toBe(2);
    expect(opts.map((o) => o.value).sort()).toEqual(["Sancti Martyres — 10 March, mr:0310-a", "Sancti Martyres — 10 March, mr:0310-b"]);
  });
});

describe("findSubject", () => {
  const opts = subjectOptions([
    entry("mr:1227-ioannes", "Sanctus Ioannes", "12-27"),
    entry("mr:0506-ioannes", "Sanctus Ioannes", "05-06"),
    entry("mr:0101-basilius", "Sanctus Basilius", "01-01"),
  ], format);

  it("matches an option exactly", () => {
    expect(findSubject(opts, "Sanctus Ioannes — 6 May")?.id).toBe("mr:0506-ioannes");
  });

  it("takes typed text when it fits exactly one option, ignoring case", () => {
    expect(findSubject(opts, "basil")?.id).toBe("mr:0101-basilius");
    expect(findSubject(opts, "ioannes")).toBeNull();
    expect(findSubject(opts, "  ")).toBeNull();
  });

  it("takes typed text with or without accents and marks", () => {
    const vn = subjectOptions([
      entry("mr:0726-emmanuel-le-van-phung", "Sant'Emanuele Lê Van Phụng", "07-31"),
      entry("mr:0130-dinh", "San Tommaso Đinh Viết Dụ", "01-30"),
      entry("mr:1122-caecilia", "Sancta Cæcilia", "11-22"),
    ], format);
    expect(findSubject(vn, "emanuele le van phung")?.id).toBe("mr:0726-emmanuel-le-van-phung");
    expect(findSubject(vn, "Lê Văn Phụng")?.id).toBe("mr:0726-emmanuel-le-van-phung");
    expect(findSubject(vn, "dinh viet")?.id).toBe("mr:0130-dinh");
    expect(findSubject(vn, "caecilia")?.id).toBe("mr:1122-caecilia");
    expect(findSubject(vn, "san")).toBeNull();
  });
});

describe("matchSubjects", () => {
  const opts = Array.from({ length: 60 }, (_, i) => ({ value: `Sanctus ${i < 30 ? "Phụng" : "Đinh"} ${i}`, id: `mr:${i}`, day: { mm: 1, dd: 1 } }));

  it("keeps the options holding the folded text, in their own order", () => {
    expect(matchSubjects(opts, "dinh 3").map((o) => o.id)).toEqual(["mr:30", "mr:31", "mr:32", "mr:33", "mr:34", "mr:35", "mr:36", "mr:37", "mr:38", "mr:39"]);
    expect(matchSubjects(opts, "PHUNG 2")[0].id).toBe("mr:2");
    expect(matchSubjects(opts, "nobody")).toEqual([]);
  });

  it("finds a subject in another language than the label's, with or without accents", () => {
    const john = [{ value: "Saint John of the Cross — 14 December", id: "mr:1214", day: { mm: 12, dd: 14 },
      also: ["Sanctus Ioannes a Cruce", "San Giovanni della Croce"] }];
    expect(matchSubjects(john, "Ioannes a Cruce").map((o) => o.id)).toEqual(["mr:1214"]);
    expect(matchSubjects(john, "giovanni della croce").map((o) => o.id)).toEqual(["mr:1214"]);
    expect(matchSubjects(john, "john of the cross").map((o) => o.id)).toEqual(["mr:1214"]);
    expect(findSubject(john, "ioannes a cruce")?.id).toBe("mr:1214");
    expect(matchSubjects(john, "Ioannes de Deo")).toEqual([]);
  });

  it("lists the first fifty at most, and with nothing typed the first fifty of all", () => {
    expect(matchSubjects(opts, "sanctus")).toHaveLength(50);
    expect(matchSubjects(opts, " ").map((o) => o.id)).toEqual(opts.slice(0, 50).map((o) => o.id));
    expect(matchSubjects(opts, "đinh", 5)).toHaveLength(5);
  });
});

describe("subjectFor", () => {
  const all = { la: "Sanctus Telesphorus", it: "San Telesforo", en: "Saint Telesphorus" };
  it("gives the reader's language when crmedr has it", () => expect(subjectFor(all, "it")).toBe("San Telesforo"));
  it("falls back to English for a language crmedr lacks", () => expect(subjectFor(all, "fr")).toBe("Saint Telesphorus"));
  it("falls back to Latin when English is empty", () => expect(subjectFor({ la: "X", en: "" }, "de")).toBe("X"));
  it("falls back to the ID when there is no subject", () => expect(subjectFor(undefined, "pt", "mr:1")).toBe("mr:1"));
});
