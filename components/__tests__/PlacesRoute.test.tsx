import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const { existsMock, infoMock, catalogMock, metaMock, indexProps } = vi.hoisted(() => ({
  existsMock: vi.fn(), infoMock: vi.fn(), catalogMock: vi.fn(), metaMock: vi.fn(), indexProps: vi.fn(),
}));
vi.mock("@/lib/server-editions", () => ({
  editionExists: existsMock, editionInfo: infoMock, fetchCatalog: catalogMock, editionMeta: metaMock,
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("@/components/PlacesIndex", () => ({ default: (p: unknown) => { indexProps(p); return null; } }));
vi.mock("@/lib/places", () => ({
  getPlaces: () => ({
    places: { Q220: { label: "Rome", country: "IT", coords: null } },
    eulogies: { "mr:0101-almachius": { place: "Q220", la: "Romæ", typology: "dies_natalis" } },
  }),
}));

import PlacesRoute, { generateMetadata } from "@/app/[locale]/read/[edition]/places/page";
import PlacesLetterRoute, { generateMetadata as letterMetadata } from "@/app/[locale]/read/[edition]/places/[letter]/page";

const params = (edition: string) => ({ params: Promise.resolve({ locale: "en", edition }) });
const E = { edition_id: "martyrologium_romanum_2004_it_IT", year: 2004, locale: "it-IT" };

describe("/read/<edition>/places", () => {
  beforeEach(() => {
    existsMock.mockReset().mockResolvedValue(true);
    infoMock.mockReset().mockResolvedValue(E);
    metaMock.mockReset().mockResolvedValue({ title: "Martirologio Romano", year: 2004 });
    catalogMock.mockReset().mockResolvedValue([
      { id: "mr:0101-almachius", subject: "Sant’Almachio", anchor_day: "01-01", deprecated: false, present: true, day_printed: "01-01", entry: 1 },
    ]);
    indexProps.mockReset();
  });

  it("404s on an unknown edition", async () => {
    existsMock.mockResolvedValue(false);
    await expect(PlacesRoute(params("nope"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("asks for the catalog in the edition's language and renders its index", async () => {
    render(await PlacesRoute(params(E.edition_id)));
    expect(catalogMock).toHaveBeenCalledWith(E.edition_id, "it");
    const props = indexProps.mock.calls[0][0];
    expect(props.edition).toBe(E.edition_id);
    expect(props.title).toBe("MARTIROLOGIO ROMANO 2004");
    expect(props.index.placed).toBe(1);
    expect(props.index.letters[0].places[0].lines[0].subject).toBe("Sant’Almachio");
  });

  it("renders the error state, not a crash, when the catalog cannot be loaded, and logs why", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const down = new Error("down");
    catalogMock.mockRejectedValue(down);
    render(await PlacesRoute(params(E.edition_id)));
    expect(indexProps.mock.calls[0][0].index).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining(E.edition_id), down);
    log.mockRestore();
  });

  it("renders the error state when the edition list cannot be asked", async () => {
    infoMock.mockResolvedValue(undefined);
    render(await PlacesRoute(params(E.edition_id)));
    expect(indexProps.mock.calls[0][0].index).toBeNull();
    expect(indexProps.mock.calls[0][0].title).toBe(E.edition_id);
  });

  it("titles the page with the edition", async () => {
    expect((await generateMetadata(params(E.edition_id))).title).toBe("Martirologio Romano 2004: index of places");
  });

  it("shows the first letter on the index's own page, and a letter's on its page, whatever the case", async () => {
    render(await PlacesRoute(params("martyrologium_romanum_2004_it_IT")));
    const first = indexProps.mock.calls[0][0];
    expect(first.letter).toBeUndefined();
    indexProps.mockReset();
    const letterParams = (letter: string) => ({ params: Promise.resolve({ locale: "en", edition: "martyrologium_romanum_2004_it_IT", letter }) });
    const someLetter = first.index.letters[0].letter as string;
    render(await PlacesLetterRoute(letterParams(someLetter.toUpperCase())));
    expect(indexProps.mock.calls[0][0].letter).toBe(someLetter);
  });

  it("404s on a letter the index does not have", async () => {
    const letterParams = { params: Promise.resolve({ locale: "en", edition: "martyrologium_romanum_2004_it_IT", letter: "q" }) };
    await expect(PlacesLetterRoute(letterParams)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("titles a letter's page with the letter", async () => {
    const letterParams = { params: Promise.resolve({ locale: "en", edition: "martyrologium_romanum_2004_it_IT", letter: "b" }) };
    expect((await letterMetadata(letterParams)).title).toMatch(/ — B$/);
  });
});
