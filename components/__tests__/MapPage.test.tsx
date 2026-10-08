import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MapPage, { defaultEdition } from "@/components/MapPage";
import type { CatalogEntryOut, EditionOut } from "@/lib/types";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }), Link: ({ href, children, ...p }: { href: string | { pathname: string }; children?: React.ReactNode }) => <a href={typeof href === "string" ? href : href.pathname} {...p}>{children}</a> }));

// The map itself is Leaflet's business (EulogyMap.test); here it reports what it was given.
vi.mock("@/components/EulogyMap", () => ({
  default: ({ entries, onPlace, selected }: {
    entries: { id: string }[];
    onPlace: (ids: string[]) => void;
    selected: { id: string; n: number } | null;
  }) => (
    <>
      <div data-testid="map">{entries.map((e) => e.id).join(",")}</div>
      <div data-testid="selected">{selected ? `${selected.id}#${selected.n}` : ""}</div>
      <button type="button" onClick={() => onPlace(entries.map((e) => e.id))}>cluster</button>
    </>
  ),
}));

vi.mock("@/lib/places", () => ({
  getPlaces: () => ({
    places: { Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5] }, Q84: { label: "London", country: "GB", coords: [51.5, -0.1] } },
    eulogies: {
      "mr:0101-a": { place: "Q220", la: "Romæ", typology: "dies_natalis" },
      "mr:0101-b": { place: "Q84", la: "Londínii", typology: "dies_natalis" },
    },
  }),
}));

const getEditions = vi.fn();
const getCatalog = vi.fn();
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getEditions: () => getEditions(),
  getCatalog: (ed: string, loc: string) => getCatalog(ed, loc),
}));

const ed = (id: string, year: number, locale: string, nature: string): EditionOut => ({
  edition_id: id, book: "mr", year, nature, scope: {}, locale, promulgation: {},
  governance: { governing_body: "x", type: "x" }, availability: { status: "public" },
});
const editions = [
  ed("mr_2004_it", 2004, "it_IT", "editio_vernacula"),
  ed("mr_2004", 2004, "la", "editio_typica_altera"),
  ed("mr_1914_en", 1914, "en", "translation"),
  { ...ed("mr_1914", 1914, "la", "editio_typica_recognita"), availability: { status: "unavailable" } },
];
const cat = (id: string): CatalogEntryOut => ({ id, subject: `S ${id}`, anchor_day: "01-01", deprecated: false, present: true, day_printed: "01-01", entry: 1 });

describe("defaultEdition", () => {
  it("is the newest Latin editio typica", () => {
    expect(defaultEdition(editions)).toBe("mr_2004");
  });
});

describe("MapPage", () => {
  beforeEach(() => {
    replace.mockClear();
    getEditions.mockReset().mockResolvedValue(editions);
    getCatalog.mockReset().mockResolvedValue([cat("mr:0101-a"), cat("mr:0101-b")]);
  });

  it("loads the default edition's catalog in its language and maps it", async () => {
    render(<MapPage initialEdition={null} />);
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-a,mr:0101-b"));
    expect(getCatalog).toHaveBeenCalledWith("mr_2004", "la");
  });

  it("an unknown ?edition= falls back to the default", async () => {
    render(<MapPage initialEdition="nope" />);
    await waitFor(() => expect(getCatalog).toHaveBeenCalledWith("mr_2004", "la"));
  });

  it("a known ?edition= is used, in that edition's language", async () => {
    render(<MapPage initialEdition="mr_1914_en" />);
    await waitFor(() => expect(getCatalog).toHaveBeenCalledWith("mr_1914_en", "en"));
  });

  it("choosing an edition reloads, puts it in the address and clears the filters", async () => {
    render(<MapPage initialEdition={null} />);
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-b"));
    fireEvent.click(screen.getByRole("checkbox", { name: /United Kingdom/ }));
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent(/^mr:0101-b$/));
    getCatalog.mockResolvedValue([cat("mr:0101-a")]);
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "mr_2004_it" } });
    expect(replace).toHaveBeenCalledWith("/map?edition=mr_2004_it", { scroll: false });
    await waitFor(() => expect(getCatalog).toHaveBeenCalledWith("mr_2004_it", "it"));
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent(/^mr:0101-a$/));
    expect(screen.getByRole("checkbox", { name: /Italy/ })).not.toBeChecked();
  });

  it("offers only editions whose texts are attached; an unavailable ?edition= falls back", async () => {
    render(<MapPage initialEdition="mr_1914" />);
    await waitFor(() => expect(getCatalog).toHaveBeenCalledWith("mr_2004", "la"));
    const values = [...(screen.getByLabelText("Edition") as HTMLSelectElement).options].map((o) => o.value);
    expect(values).not.toContain("mr_1914");
    expect(getCatalog).not.toHaveBeenCalledWith("mr_1914", expect.anything());
  });

  it("a clicked cluster lists its eulogies under their places' names", async () => {
    render(<MapPage initialEdition={null} />);
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-b"));
    fireEvent.click(screen.getByRole("button", { name: "cluster" }));
    expect(screen.getByRole("heading", { name: "Rome / London — 2 eulogies" })).toBeInTheDocument();
  });

  it("switching edition clears the previous edition's markers, and keeps them cleared if the new one fails", async () => {
    render(<MapPage initialEdition={null} />);
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-b"));
    getCatalog.mockRejectedValue(new Error("down"));
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "mr_2004_it" } });
    expect(screen.getByTestId("map")).toBeEmptyDOMElement();
    await screen.findByRole("button", { name: "Retry" });
    expect(screen.getByTestId("map")).toBeEmptyDOMElement();
  });

  it("picking the same result again asks the map to reveal it again", async () => {
    render(<MapPage initialEdition={null} />);
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-b"));
    const row = screen.getByRole("button", { name: /S mr:0101-a/ });
    fireEvent.click(row);
    const first = screen.getByTestId("selected").textContent;
    fireEvent.click(row);
    expect(screen.getByTestId("selected").textContent).toMatch(/^mr:0101-a#/);
    expect(screen.getByTestId("selected").textContent).not.toBe(first);
  });

  it("says so when no edition has texts to map, instead of loading forever", async () => {
    getEditions.mockResolvedValue([{ ...editions[3] }]); // mr_1914: unavailable
    render(<MapPage initialEdition={null} />);
    expect(await screen.findByText(/No edition has texts to map/)).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    expect(getCatalog).not.toHaveBeenCalled();
  });

  it("searching narrows the map", async () => {
    render(<MapPage initialEdition={null} />);
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-b"));
    fireEvent.change(screen.getByLabelText("Search subject or ID"), { target: { value: "london" } });
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent(/^mr:0101-b$/));
  });

  it("a failed catalog offers a retry that refetches", async () => {
    getCatalog.mockRejectedValueOnce(new Error("boom"));
    render(<MapPage initialEdition={null} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-a"));
    expect(getCatalog).toHaveBeenCalledTimes(2);
  });
});
