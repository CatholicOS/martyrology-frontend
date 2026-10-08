import { describe, it, expect, vi, afterEach } from "vitest";
import { editionExists, editionInfo, editionMeta, fetchCatalog } from "@/lib/server-editions";

afterEach(() => vi.restoreAllMocks());

describe("editionMeta", () => {
  it("returns the title-cased name and year of a known edition", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ editions: [{ edition_id: "mr1749", year: 1749, locale: "la" }] })),
    );
    expect(await editionMeta("mr1749")).toEqual({ title: "Martyrologium Romanum", year: 1749 });
  });
  it("is null for an unknown edition or when unreachable", async () => {
    // a new Response per call: an unknown id asks the cached list, then a fresh one
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ editions: [] })));
    expect(await editionMeta("x")).toBeNull();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect(await editionMeta("x")).toBeNull();
  });
});

describe("editionExists", () => {
  const list = (...ids: string[]) =>
    new Response(JSON.stringify({ editions: ids.map((edition_id) => ({ edition_id, year: 1630, locale: "la" })) }));

  it("answers from the cached list when the edition is in it, without a second request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(list("mr1749"));
    expect(await editionExists("mr1749")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toEqual({ next: { revalidate: 3600 } });
  });

  it("finds an edition published since the cache was filled, with one uncached request", async () => {
    // the cached list predates the release; the fresh one has the new edition
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(list("mr1749"))
      .mockResolvedValueOnce(list("mr1630", "mr1749"));
    expect(await editionExists("mr1630")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toEqual({ cache: "no-store" });
  });

  it("is false for an edition neither list knows", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(list("mr1749")).mockResolvedValueOnce(list("mr1749"));
    expect(await editionExists("nope")).toBe(false);
  });

  it("is false when the cached list misses it and the fresh request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(list("mr1749")).mockRejectedValueOnce(new Error("down"));
    expect(await editionExists("nope")).toBe(false);
  });

  it("assumes yes when the API cannot be asked at all", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect(await editionExists("mr1630")).toBe(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    expect(await editionExists("mr1630")).toBe(true);
  });
});

describe("editionMeta after a release", () => {
  it("names an edition that only the fresh list has", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ editions: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ editions: [{ edition_id: "mr1630", year: 1630, locale: "la" }] })));
    expect(await editionMeta("mr1630")).toEqual({ title: "Martyrologium Romanum", year: 1630 });
  });
});

describe("editionInfo", () => {
  it("returns the API's edition, null when unknown, undefined when the API cannot be asked", async () => {
    const e = { edition_id: "mr1749", year: 1749, locale: "la" };
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ editions: [e] })));
    expect(await editionInfo("mr1749")).toEqual(e);
    expect(await editionInfo("nope")).toBeNull();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect(await editionInfo("mr1749")).toBeUndefined();
  });
});

describe("fetchCatalog", () => {
  it("asks the API for the edition's catalog in the given language, cached hourly", async () => {
    const elogia = [{ id: "mr:0101-basilius", subject: "Sanctus Basilius", anchor_day: "01-01", deprecated: false, present: true, day_printed: "01-01", entry: 2 }];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ elogia })));
    expect(await fetchCatalog("martyrologium_romanum_2004_it_IT", "it")).toEqual(elogia);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/elogia\?edition=martyrologium_romanum_2004_it_IT&locale=it$/);
    expect(fetchMock.mock.calls[0][1]).toEqual({ next: { revalidate: 3600 } });
  });

  it("asks again past the cache when a cached answer is not a catalog", async () => {
    const elogia = [{ id: "mr:0101-basilius", subject: "Sanctus Basilius", anchor_day: "01-01", deprecated: false, present: true, day_printed: "01-01", entry: 2 }];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("<html>proxy error</html>"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ elogia })));
    expect(await fetchCatalog("x", "la")).toEqual(elogia);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toEqual({ cache: "no-store" });
  });

  it("throws when neither the cached nor a fresh answer is a catalog", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ title: "not a catalog" })));
    await expect(fetchCatalog("x", "la")).rejects.toThrow(/not a catalog/);
  });

  it("throws when the API answers with an error or cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    await expect(fetchCatalog("x", "la")).rejects.toThrow();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    await expect(fetchCatalog("x", "la")).rejects.toThrow();
  });
});
