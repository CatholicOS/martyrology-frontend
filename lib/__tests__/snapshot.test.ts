import { describe, it, expect, vi } from "vitest";
import { buildMisprints, buildNotes, buildPlaces, buildSnapshot, fetchPlaceData, labelsQuery, parseWktPoint, resolvedQids } from "@/scripts/snapshot-registry.mjs";

const registry = { entries: [
  { id: "mr:0104-titus", month: 1, day: 4, entry: 2, asterisk: false, country: "GR" },
  { id: "mr:0101-circumcisio-domini", month: 1, day: 1, entry: 1, deprecated: true, attested_in: "martyrologium_romanum_1749", country: null, unnumbered: true },
]};
const la = { "mr:0104-titus": "Sanctus Titus", "mr:0101-circumcisio-domini": "Circumcisio Domini" };
const itSubj = { "mr:0104-titus": "", "mr:0101-circumcisio-domini": "" };
const en = { "mr:0104-titus": "Saint Titus", "mr:0101-circumcisio-domini": "" };

describe("buildSnapshot", () => {
  it("merges registry + i18n into per-id entries", () => {
    const snap = buildSnapshot(registry, la, itSubj, en);
    expect(snap["mr:0104-titus"]).toEqual({
      deprecated: false, month: 1, day: 4, entry: 2, asterisk: false, unnumbered: false,
      country: "GR", attested_in: null, subject: { la: "Sanctus Titus", it: "", en: "Saint Titus" },
    });
    expect(snap["mr:0101-circumcisio-domini"].deprecated).toBe(true);
    expect(snap["mr:0101-circumcisio-domini"].attested_in).toBe("martyrologium_romanum_1749");
  });
});

describe("buildMisprints", () => {
  it("keeps id, edition, printed and intended, dropping curation metadata", () => {
    const doc = { misprints: [
      { id: "mr:0305-phoca", edition: "martyrologium_romanum_2004_it_IT", printed: "nell’odiena", intended: "nell’odierna", verified: "print" },
    ] };
    expect(buildMisprints(doc)).toEqual([
      { id: "mr:0305-phoca", edition: "martyrologium_romanum_2004_it_IT", printed: "nell’odiena", intended: "nell’odierna" },
    ]);
  });
});

describe("buildNotes", () => {
  it("keeps the curators' notes by id, skipping entries without one", () => {
    const doc = { entries: [
      { id: "mr:0220-eleutherius-et-socii", month: 2, day: 20, note: "Probably mr:0218-sadoth-et-socii." },
      { id: "mr:0104-titus", month: 1, day: 4, note: null },
      { id: "mr:0101-basilius", month: 1, day: 1 },
    ] };
    expect(buildNotes(doc)).toEqual({ "mr:0220-eleutherius-et-socii": { note: "Probably mr:0218-sadoth-et-socii." } });
  });

  it("keeps the notes on one edition's text apart, by edition", () => {
    const doc = { entries: [
      { id: "mr:0625-prosperus", month: 6, day: 25,
        edition_notes: { martyrologium_romanum_1914_en_unofficial: "Riez.", martyrologium_romanum_1749: "Conflated." } },
      { id: "mr:1003-candida", month: 10, day: 3, note: "Candidus.", edition_notes: {} as Record<string, string> },
    ] };
    expect(buildNotes(doc)).toEqual({
      "mr:0625-prosperus": { editions: { martyrologium_romanum_1914_en_unofficial: "Riez.", martyrologium_romanum_1749: "Conflated." } },
      "mr:1003-candida": { note: "Candidus." },
    });
  });
});

describe("buildPlaces", () => {
  const placesDoc = { places: {
    "mr:0101-almachius": [{ role: "death", la: "Romæ", it: "A Roma", source: "lead" }],
    "mr:0102-x": [
      { role: "death", la: "Nusquam", source: "lead" },
      { role: "burial", la: "Mediolani", source: "lead" },
    ],
    "mr:0103-y": [{ role: "death", la: "Nusquam", source: "lead" }],
    "mr:0104-z": [{ role: "death", la: "Insula", source: "lead" }],
  } };
  const gazetteerDoc = { places: {
    "Romæ": { wikidata: "Q220", label: "Rome", country: "IT", status: "auto" },
    "Mediolani": { wikidata: "Q490", label: "Milan", country: "IT", status: "reviewed" },
    "Insula": { wikidata: "Q999", label: "Island", country: "GR", status: "reviewed" },
  } };
  const typologyDoc = { typology: { "mr:0101-almachius": "dies_natalis", "mr:0102-x": "depositio", "mr:0104-z": "dies_natalis" } };
  const coords = { Q220: [41.893, 12.483] as [number, number], Q490: [45.464, 9.19] as [number, number] };

  it("gives each eulogy its first resolved place, its Italian form, typology, and the place's coordinates and labels", () => {
    const labels = { Q220: { en: "Rome", it: "Roma", fr: "Rome" }, Q490: { it: "Milano" } };
    expect(buildPlaces(placesDoc, gazetteerDoc, typologyDoc, coords, labels)).toEqual({
      places: {
        Q220: { label: "Rome", country: "IT", coords: [41.893, 12.483], labels: { en: "Rome", it: "Roma", fr: "Rome" } },
        Q490: { label: "Milan", country: "IT", coords: [45.464, 9.19], labels: { it: "Milano" } },
        Q999: { label: "Island", country: "GR", coords: null },
      },
      eulogies: {
        "mr:0101-almachius": { place: "Q220", la: "Romæ", it: "A Roma", typology: "dies_natalis" },
        "mr:0102-x": { place: "Q490", la: "Mediolani", typology: "depositio" },
        "mr:0104-z": { place: "Q999", la: "Insula", typology: "dies_natalis" },
      },
    });
  });

  it("writes each place's labels in the interface languages' order, whatever order Wikidata gives them in", () => {
    const labels = { Q220: { pt: "Roma", en: "Rome", de: "Rom", it: "Roma" } };
    const snap = buildPlaces(placesDoc, gazetteerDoc, typologyDoc, coords, labels);
    expect(Object.keys(snap.places.Q220.labels ?? {})).toEqual(["en", "it", "de", "pt"]);
  });

  it("keeps a place without coordinates, for the index, with null coordinates", () => {
    const snap = buildPlaces(placesDoc, gazetteerDoc, typologyDoc, {});
    expect(snap.places.Q220.coords).toBeNull();
    expect(snap.eulogies["mr:0101-almachius"].place).toBe("Q220");
  });

  it("gives the QID as the label of a place the gazetteer has no label for", () => {
    const snap = buildPlaces(
      { places: { "mr:0101-a": [{ role: "death", la: "Nullibi", source: "lead" }] } },
      { places: { Nullibi: { wikidata: "Q5", status: "auto" } } },
      { typology: {} },
      {},
    );
    expect(snap.places.Q5.label).toBe("Q5");
  });

  it("lists the resolved QIDs once each, sorted", () => {
    expect(resolvedQids(placesDoc, gazetteerDoc)).toEqual(["Q220", "Q490", "Q999"]);
  });

  it("a eulogy without typology gets null", () => {
    const snap = buildPlaces(placesDoc, gazetteerDoc, { typology: {} }, coords);
    expect(snap.eulogies["mr:0101-almachius"].typology).toBeNull();
  });
});

describe("parseWktPoint", () => {
  it("reads Wikidata's Point(lon lat) as [lat, lon]", () => {
    expect(parseWktPoint("Point(12.4825 41.8931)")).toEqual([41.8931, 12.4825]);
    expect(parseWktPoint("Point(-0.1275 51.507222222)")).toEqual([51.507222222, -0.1275]);
  });
  it("rejects anything else", () => {
    expect(parseWktPoint("<http://www.wikidata.org/entity/Q405> Point(1 2)")).toBeNull();
    expect(parseWktPoint("garbage")).toBeNull();
  });
});

describe("labelsQuery", () => {
  it("asks for the labels of the items in the six interface languages", () => {
    const q = labelsQuery(["Q220", "Q490"]);
    expect(q).toContain("VALUES ?item { wd:Q220 wd:Q490 }");
    expect(q).toContain("rdfs:label ?label");
    expect(q).toContain('FILTER(LANG(?label) IN ("en", "it", "fr", "de", "es", "pt"))');
  });
});

describe("fetchPlaceData", () => {
  const previous = {
    places: {
      Q220: { coords: [41, 12] as [number, number], labels: { en: "Rome (old)" } },
      Q999: { coords: null, labels: { en: "Island (old)" } },
    },
  };
  const fresh = {
    coords: async () => ({ Q220: [41.9, 12.5] as [number, number], Q490: [45.5, 9.2] as [number, number] }),
    labels: async () => ({ Q220: { en: "Rome" }, Q490: { en: "Milan" } }),
  };
  const down = async () => { throw new Error("Wikidata SPARQL 429"); };

  it("keeps what Wikidata gives when both queries answer", async () => {
    const readPrevious = vi.fn(() => previous);
    expect(await fetchPlaceData(["Q220", "Q490"], readPrevious, fresh)).toEqual({
      coords: { Q220: [41.9, 12.5], Q490: [45.5, 9.2] },
      labels: { Q220: { en: "Rome" }, Q490: { en: "Milan" } },
    });
    expect(readPrevious).not.toHaveBeenCalled();
  });

  it("keeps the fresh coordinates when only the labels query fails", async () => {
    const data = await fetchPlaceData(["Q220", "Q490"], () => previous, { ...fresh, labels: down });
    expect(data.coords).toEqual({ Q220: [41.9, 12.5], Q490: [45.5, 9.2] });
    expect(data.labels).toEqual({ Q220: { en: "Rome (old)" }, Q999: { en: "Island (old)" } });
  });

  it("keeps the fresh labels when only the coordinates query fails", async () => {
    const data = await fetchPlaceData(["Q220", "Q490"], () => previous, { ...fresh, coords: down });
    expect(data.coords).toEqual({ Q220: [41, 12] });
    expect(data.labels).toEqual({ Q220: { en: "Rome" }, Q490: { en: "Milan" } });
  });
});
