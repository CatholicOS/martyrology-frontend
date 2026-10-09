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
vi.mock("@/components/NamesIndex", () => ({ default: (p: unknown) => { indexProps(p); return null; } }));
vi.mock("@/lib/persons", () => ({
  getPersons: () => ({ editions: { martyrologium_romanum_2004: {
    "mr:0101-basilius": [{ name: "Basilius", where: "text", wikidata: "Q1" }] } }, labels: {} }),
}));
vi.mock("@/lib/persons-editions", () => ({ hasPersons: (e: string) => e === "martyrologium_romanum_2004" }));

import NamesRoute, { generateMetadata } from "@/app/[locale]/read/[edition]/names/page";

const params = (edition: string) => ({ params: Promise.resolve({ locale: "en", edition }) });
const LA = { edition_id: "martyrologium_romanum_2004", year: 2004, locale: "la" };
const OLD = { edition_id: "martyrologium_romanum_1749", year: 1749, locale: "la" };

describe("/read/<edition>/names", () => {
  beforeEach(() => {
    existsMock.mockReset().mockResolvedValue(true);
    infoMock.mockReset().mockResolvedValue(LA);
    metaMock.mockReset().mockResolvedValue({ title: "Martyrologium Romanum", year: 2004 });
    catalogMock.mockReset().mockResolvedValue([
      { id: "mr:0101-basilius", subject: "Sanctus Basilius", anchor_day: "01-01", deprecated: false, present: true, day_printed: "01-01", entry: 1 },
    ]);
    indexProps.mockReset();
  });

  it("404s on an unknown edition", async () => {
    existsMock.mockResolvedValue(false);
    await expect(NamesRoute(params("nope"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("asks for the catalog in the edition's language and renders its index", async () => {
    render(await NamesRoute(params(LA.edition_id)));
    expect(catalogMock).toHaveBeenCalledWith(LA.edition_id, "la");
    const props = indexProps.mock.calls[0][0];
    expect(props.title).toBe("MARTYROLOGIUM ROMANUM 2004");
    expect(props.index.naming).toBe(1);
    expect(props.error).toBe(false);
  });

  it("does not ask for the catalog of an edition without persons, and says it is not indexed", async () => {
    infoMock.mockResolvedValue(OLD);
    render(await NamesRoute(params(OLD.edition_id)));
    expect(catalogMock).not.toHaveBeenCalled();
    expect(indexProps.mock.calls[0][0]).toMatchObject({ index: null, error: false });
  });

  it("renders the error state and logs why when the catalog cannot be loaded", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const down = new Error("down");
    catalogMock.mockRejectedValue(down);
    render(await NamesRoute(params(LA.edition_id)));
    expect(indexProps.mock.calls[0][0]).toMatchObject({ index: null, error: true });
    expect(log).toHaveBeenCalledWith(expect.stringContaining(LA.edition_id), down);
    log.mockRestore();
  });

  it("renders the error state when the edition list cannot be asked", async () => {
    infoMock.mockResolvedValue(undefined);
    render(await NamesRoute(params(LA.edition_id)));
    expect(indexProps.mock.calls[0][0]).toMatchObject({ index: null, error: true, title: LA.edition_id });
  });

  it("titles the page with the edition", async () => {
    expect((await generateMetadata(params(LA.edition_id))).title).toBe("Martyrologium Romanum 2004: index of names");
  });
});
