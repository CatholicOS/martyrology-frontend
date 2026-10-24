import { createTranslator } from "use-intl";
import en from "@/messages/en.json";
import { describe, it, expect } from "vitest";
import { facetCounts, filterEntries, mapEntries, matchesQuery, typologyLabel, type MapFilters } from "@/lib/map-data";
import type { PlacesSnapshot } from "@/lib/places";
import type { CatalogEntryOut } from "@/lib/types";

const snap: PlacesSnapshot = {
  places: {
    Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5], labels: { en: "Rome", it: "Roma" } },
    Q84: { label: "London", country: "GB", coords: [51.5, -0.1] },
    Q1: { label: "Caesarea", country: "TR", coords: [38.7, 35.5] },
    Q2: { label: "Nowhere", country: "", coords: null },
  },
  eulogies: {
    "mr:0101-almachius": { typology: "dies_natalis", places: [{ place: "Q220", la: "Romæ", roles: [{ role: "death" }] }] },
    "mr:0102-caecilia": { typology: "depositio", places: [{ place: "Q220", la: "Romæ", roles: [{ role: "death" }] }] },
    "mr:0103-thomas": { typology: "dies_natalis", places: [{ place: "Q84", la: "Londínii", roles: [{ role: "death" }] }] },
    "mr:0104-basilius": { typology: null, places: [{ place: "Q1", la: "Cæsaréæ in Cappadócia", roles: [{ role: "death" }] }] },
    "mr:0107-nemo": { typology: "dies_natalis", places: [{ place: "Q2", la: "Nusquam", roles: [{ role: "death" }] }] },
  },
};

const cat = (id: string, subject: string, day: string, entry: number | null = 1, present = true): CatalogEntryOut => ({
  id, subject, anchor_day: day, deprecated: false, present, day_printed: day, entry,
});

const catalog: CatalogEntryOut[] = [
  cat("mr:0103-thomas", "Sanctus Thomas", "01-03"),
  cat("mr:0101-almachius", "Sanctus Almachius", "01-01", 4),
  cat("mr:0102-caecilia", "Sancta Cæcilia", "01-02"),
  cat("mr:0104-basilius", "Sanctus Basilius", "01-04"),
  cat("mr:0105-absent", "Sanctus Absens", "01-05", 1, false),
  cat("mr:0106-martina", "Sancta Martina", "01-06"), // printed, but no place (deprecated ID)
  cat("mr:0107-nemo", "Sanctus Nemo", "01-07"), // placed, but no coordinates: not on the map
];

const all: MapFilters = { query: "", hiddenTypologies: new Set(), countries: new Set(), hiddenRoles: new Set() };

describe("mapEntries", () => {
  it("keeps the eulogies the edition prints that have a place, in printed order, and counts the rest", () => {
    const { entries, unmapped } = mapEntries(catalog, snap, "en");
    expect(entries.map((e) => e.id)).toEqual(["mr:0101-almachius", "mr:0102-caecilia", "mr:0103-thomas", "mr:0104-basilius"]);
    expect(unmapped).toBe(2); // mr:0106-martina has no place, mr:0107-nemo no coordinates; mr:0105-absent is not printed at all
    expect(entries[0]).toEqual({
      key: "mr:0101-almachius@Q220", id: "mr:0101-almachius", subject: "Sanctus Almachius", editionSubject: "Sanctus Almachius", day: { mm: 1, dd: 1 }, entry: 4,
      qid: "Q220", la: "Romæ", label: "Rome", labelLang: "en", labelEn: "Rome", country: "IT", coords: [41.9, 12.5], typology: "dies_natalis",
      roles: [{ role: "death" }],
    });
  });

  it("puts a place whose site is disputed at its possible sites, as one entry", () => {
    // Emmaus has its own point and six proposed sites; Salem has no point of its own.
    const disputed: PlacesSnapshot = {
      places: {
        Q165887: { label: "Emmaus", country: "", countries: ["IL", "PS"], coords: [31.84, 34.99], sites: [
          { place: "Q847246", label: "Emmaus Nicopolis", coords: [31.84, 34.99] },
          { place: "Q335023", label: "Abu Ghosh", labels: { en: "Abu Ghosh", it: "Abu Gosh" }, coords: [31.8, 35.11] },
        ] },
        Q4377375: { label: "Salem", country: "", countries: ["IL", "PS"], coords: null, sites: [
          { place: "Q1218", label: "Jerusalem", coords: [31.78, 35.22] },
          { place: "Q20395636", label: "Salim, Nablus", coords: [32.21, 35.34] },
        ] },
      },
      eulogies: {
        "mr:0925-cleopha": { typology: "commemoratio", places: [{ place: "Q165887", la: "castéllo Emmaus", roles: [{ role: "residence" }] }] },
        "mr:0826-melchisedech": { typology: "commemoratio", places: [{ place: "Q4377375", la: "Salem", roles: [{ role: "ministry" }] }] },
      },
    };
    const { entries, mapped, unmapped } = mapEntries(
      [cat("mr:0826-melchisedech", "Sanctus Melchisedech", "08-26"), cat("mr:0925-cleopha", "Sanctus Cleophas", "09-25")], disputed, "it");
    expect([mapped, unmapped, entries.length]).toEqual([2, 0, 2]);
    const emmaus = entries.find((e) => e.qid === "Q165887")!;
    // At its first site, not at its own point: the sites are where it is shown.
    expect(emmaus.coords).toEqual([31.84, 34.99]);
    expect(emmaus.sites).toEqual([
      { qid: "Q847246", label: "Emmaus Nicopolis", labelLang: "en", coords: [31.84, 34.99] },
      { qid: "Q335023", label: "Abu Gosh", labelLang: "it", coords: [31.8, 35.11] },
    ]);
    expect(entries.find((e) => e.qid === "Q4377375")!.coords).toEqual([31.78, 35.22]);
    expect(mapEntries(catalog, snap, "en").entries[0]).not.toHaveProperty("sites");
  });

  it("names a place in the interface language, else in English, and says which", () => {
    const it_ = mapEntries(catalog, snap, "it").entries;
    expect(it_.find((e) => e.qid === "Q220")).toMatchObject({ label: "Roma", labelLang: "it", labelEn: "Rome" });
    expect(it_.find((e) => e.qid === "Q84")).toMatchObject({ label: "London", labelLang: "en" });
  });

  it("finds a place by its English name on a page in another language", () => {
    const roma = mapEntries(catalog, snap, "it").entries.find((e) => e.qid === "Q220")!;
    expect(matchesQuery(roma, "roma")).toBe(true);
    expect(matchesQuery(roma, "rome")).toBe(true);
  });

  it("shows the subject the caller picks for the interface", () => {
    const { entries } = mapEntries(catalog, snap, "en", (id, own) => `${id} / ${own}`);
    expect(entries[0].subject).toBe(`${entries[0].id} / Sanctus Almachius`);
  });

  it("a catalog entry without subject falls back to its ID", () => {
    const { entries } = mapEntries([{ ...catalog[0], subject: null }], snap, "en");
    expect(entries[0].subject).toBe("mr:0103-thomas");
  });
});

describe("matchesQuery", () => {
  const { entries } = mapEntries(catalog, snap, "en");
  const byId = (id: string) => entries.find((e) => e.id === id)!;

  it("matches both the interface subject and the catalog's own (Latin) one", () => {
    const e = { ...byId("mr:0101-almachius"), subject: "Saint Telesphorus", editionSubject: "Sanctus Telesphorus" };
    expect(matchesQuery(e, "Sanctus")).toBe(true);
    expect(matchesQuery(e, "Saint")).toBe(true);
    expect(matchesQuery(e, "Beatus")).toBe(false);
  });

  it("matches subject and ID, ignoring case, accents and the æ/œ ligatures", () => {
    expect(matchesQuery(byId("mr:0102-caecilia"), "caecilia")).toBe(true);
    expect(matchesQuery(byId("mr:0102-caecilia"), "CÆCILIA")).toBe(true);
    expect(matchesQuery(byId("mr:0103-thomas"), "0103-tho")).toBe(true);
    expect(matchesQuery(byId("mr:0103-thomas"), "caecilia")).toBe(false);
  });

  it("matches the place as printed and its Wikidata label", () => {
    expect(matchesQuery(byId("mr:0104-basilius"), "cesarea")).toBe(false); // e ≠ ae
    expect(matchesQuery(byId("mr:0104-basilius"), "caesarea")).toBe(true);
    expect(matchesQuery(byId("mr:0103-thomas"), "london")).toBe(true);
  });

  it("finds a subject by its stroke letters' plain forms (Đ → d)", () => {
    const dinh = { ...byId("mr:0103-thomas"), subject: "San Tommaso Đinh Viết Dụ" };
    expect(matchesQuery(dinh, "dinh viet du")).toBe(true);
  });

  it("finds a place printed with an accented ligature (ǽ)", () => {
    const nicaea = { ...byId("mr:0104-basilius"), la: "Nicǽæ in Bithýnia" };
    expect(matchesQuery(nicaea, "nicaeae")).toBe(true);
  });

  it("an empty or blank query matches everything", () => {
    expect(matchesQuery(byId("mr:0103-thomas"), "  ")).toBe(true);
  });
});

describe("filterEntries and facetCounts", () => {
  const { entries } = mapEntries(catalog, snap, "en");

  it("hides unchecked typologies (null typology is 'none') and keeps only the chosen countries", () => {
    expect(filterEntries(entries, { ...all, hiddenTypologies: new Set(["dies_natalis"]) }).map((e) => e.id))
      .toEqual(["mr:0102-caecilia", "mr:0104-basilius"]);
    expect(filterEntries(entries, { ...all, hiddenTypologies: new Set(["none"]) }).map((e) => e.id))
      .not.toContain("mr:0104-basilius");
    expect(filterEntries(entries, { ...all, countries: new Set(["IT", "GB"]) }).map((e) => e.id))
      .toEqual(["mr:0101-almachius", "mr:0102-caecilia", "mr:0103-thomas"]);
  });

  it("a place in several countries is filtered and counted under each", () => {
    const frisia: PlacesSnapshot = {
      places: { Q165111: { label: "Frisia", country: "", countries: ["NL", "DE"], coords: [53.2, 6.0] } },
      eulogies: { "mr:0605-bonifatius": { typology: "dies_natalis", places: [{ place: "Q165111", la: "in Frísia", roles: [{ role: "death" }] }] } },
    };
    const { entries: fe } = mapEntries([cat("mr:0605-bonifatius", "Sanctus Bonifatius", "06-05")], frisia, "en");
    expect(filterEntries(fe, { ...all, countries: new Set(["DE"]) }).map((e) => e.id)).toEqual(["mr:0605-bonifatius"]);
    expect(filterEntries(fe, { ...all, countries: new Set(["FR"]) })).toEqual([]);
    expect(facetCounts(fe, all).countries).toEqual([["DE", 1], ["NL", 1]]);
  });

  it("counts each facet under the other filters, not its own", () => {
    const f: MapFilters = { query: "", hiddenTypologies: new Set(["depositio"]), countries: new Set(["IT"]), hiddenRoles: new Set() };
    const { typologies, countries } = facetCounts(entries, f);
    // typologies: filtered by country IT only → almachius (dies_natalis), caecilia (depositio)
    expect(typologies).toEqual([["dies_natalis", 1], ["depositio", 1]]);
    // countries: filtered by typology (depositio hidden) only → almachius IT, thomas GB, basilius TR
    expect(countries).toEqual([["GB", 1], ["IT", 1], ["TR", 1]]);
  });

  it("typologies are listed in the crmedr order, with 'none' last", () => {
    const { typologies } = facetCounts(entries, all);
    expect(typologies.map(([t]) => t)).toEqual(["dies_natalis", "depositio", "none"]);
  });
});

describe("typologyLabel", () => {
  it("reads the value as words", () => {
    const t = createTranslator({ locale: "en", messages: en, namespace: "Map" });
    expect(typologyLabel(t, "dies_natalis")).toBe("Dies natalis");
    expect(typologyLabel(t, null)).toBe("Not classified");
    expect(typologyLabel(t, "some_new_kind")).toBe("Some new kind");
  });
});

describe("mapEntries: places and roles", () => {
  const snapTwo: PlacesSnapshot = {
    places: { Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5] }, Q490: { label: "Milan", country: "IT", coords: [45.5, 9.2] } },
    eulogies: {
      "mr:0101-a": { typology: "dies_natalis", places: [
        { place: "Q220", la: "Romæ", roles: [{ role: "death" }] },
        { place: "Q490", la: "Mediolani", roles: [{ role: "birth" }] },
      ] },
    },
  };
  const one = [cat("mr:0101-a", "Sanctus A", "01-01")];

  it("two places of one eulogy are two entries with their own keys", () => {
    const { entries } = mapEntries(one, snapTwo, "en");
    expect(entries.map((e) => [e.key, e.id, e.qid, e.roles])).toEqual([
      ["mr:0101-a@Q220", "mr:0101-a", "Q220", [{ role: "death" }]],
      ["mr:0101-a@Q490", "mr:0101-a", "Q490", [{ role: "birth" }]],
    ]);
  });

  it("counts the mapped eulogies, not their places", () => {
    expect(mapEntries(one, snapTwo, "en").mapped).toBe(1);
  });

  it("hiding a role hides the entries that have no other", () => {
    const { entries } = mapEntries(one, snapTwo, "en");
    expect(filterEntries(entries, { ...all, hiddenRoles: new Set(["birth"]) }).map((e) => e.key)).toEqual(["mr:0101-a@Q220"]);
    expect(facetCounts(entries, all).roles).toEqual([["death", 1], ["birth", 1]]);
  });
});
