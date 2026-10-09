import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@/test/intl";
import MapSidebar from "@/components/MapSidebar";
import type { MapEntry, MapFilters } from "@/lib/map-data";
import type { EditionOut } from "@/lib/types";

const edition = (id: string, year: number, locale: string, nature = "editio_typica"): EditionOut => ({
  edition_id: id, book: "mr", year, nature, scope: {}, locale, promulgation: {},
  governance: { governing_body: "x", type: "x" }, availability: { status: "public" },
});
const editions = [edition("mr_2004", 2004, "la"), edition("mr_1914_en", 1914, "en", "translation")];

const entry = (id: string, subject: string, label: string): MapEntry => ({
  id, subject, editionSubject: subject, day: { mm: 1, dd: 1 }, entry: 1, qid: "Q1", la: "Romæ", label, labelLang: label === "Roma" ? "it" : "en", labelEn: "Rome", country: "IT", coords: [0, 0], typology: "dies_natalis",
});
const results = [entry("mr:0101-almachius", "Sanctus Almachius", "Rome"), entry("mr:0102-x", "Sanctus X", "Rome")];
const filters: MapFilters = { query: "", hiddenTypologies: new Set(), countries: new Set() };

function setup(over: Partial<React.ComponentProps<typeof MapSidebar>> = {}, locale: "en" | "it" = "en") {
  const props: React.ComponentProps<typeof MapSidebar> = {
    editions, edition: "mr_2004", onEdition: vi.fn(), filters, onFilters: vi.fn(),
    facets: { typologies: [["dies_natalis", 2], ["none", 1]], countries: [["IT", 2], ["DE", 1]] },
    results, mapped: 3, unmapped: 5, place: null, onShowAll: vi.fn(), selected: null, onSelect: vi.fn(),
    status: { loading: false, error: null }, onRetry: vi.fn(), ...over,
  };
  render(<MapSidebar {...props} />, { locale });
  return props;
}

describe("MapSidebar", () => {
  it("chooses the edition", () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "mr_1914_en" } });
    expect(p.onEdition).toHaveBeenCalledWith("mr_1914_en");
  });

  it("searches", () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText("Search subject or ID"), { target: { value: "alm" } });
    expect(p.onFilters).toHaveBeenCalledWith({ ...filters, query: "alm" });
  });

  it("unchecking a typology hides it", () => {
    const p = setup();
    const box = screen.getByRole("checkbox", { name: /Dies natalis/ });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(p.onFilters).toHaveBeenCalledWith({ ...filters, hiddenTypologies: new Set(["dies_natalis"]) });
    expect(screen.getByRole("checkbox", { name: /Not classified/ })).toBeInTheDocument();
  });

  it("lists countries by name with counts, and checking one selects it", () => {
    const p = setup();
    const group = screen.getByRole("group", { name: "Country" });
    const labels = within(group).getAllByRole("checkbox").map((b) => b.closest("label")!.textContent);
    expect(labels).toEqual(["Germany (1)", "Italy (2)"]);
    fireEvent.click(within(group).getByRole("checkbox", { name: /Italy/ }));
    expect(p.onFilters).toHaveBeenCalledWith({ ...filters, countries: new Set(["IT"]) });
  });

  it("names the countries in the reader's language", () => {
    setup({}, "it");
    const group = screen.getByRole("group", { name: "Paese" });
    expect(within(group).getAllByRole("checkbox").map((b) => b.closest("label")!.textContent)).toEqual(["Germania (1)", "Italia (2)"]);
  });

  it("narrows the country list by name", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Filter countries"), { target: { value: "ger" } });
    const group = screen.getByRole("group", { name: "Country" });
    expect(within(group).getAllByRole("checkbox")).toHaveLength(1);
  });

  it("summarises and lists the results; a click selects", () => {
    const p = setup();
    expect(screen.getByText("2 shown · 3 mapped · 5 not mapped in this edition")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sanctus Almachius/ }));
    expect(p.onSelect).toHaveBeenCalledWith("mr:0101-almachius");
  });

  it("lists a place's eulogies with a way back", () => {
    const p = setup({ place: { labels: [{ label: "Rome", lang: "en" }], count: 2 } });
    expect(screen.getByRole("heading", { name: "Rome — 2 eulogies" })).toBeInTheDocument();
    // English on an English page: no lang of its own.
    expect(within(screen.getByRole("heading", { name: "Rome — 2 eulogies" })).getByText("Rome").closest("[lang]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(p.onShowAll).toHaveBeenCalled();
  });

  it("marks a place's name that fell back to English as English, each of a point's names in its own language", () => {
    setup({ place: { labels: [{ label: "Kayseri", lang: "it" }, { label: "Caesarea", lang: "en" }], count: 3 } }, "it");
    const h = screen.getByRole("heading", { name: /^Kayseri \/ Caesarea — 3/ });
    expect(within(h).getByText("Kayseri").closest("[lang]")).toBeNull();
    expect(within(h).getByText("Caesarea")).toHaveAttribute("lang", "en");
    expect(screen.getAllByText("Rome")[0]).toHaveAttribute("lang", "en");
  });

  it("says when nothing matches", () => {
    setup({ results: [] });
    expect(screen.getByText("No eulogy matches these filters.")).toBeInTheDocument();
  });

  it("offers a retry when the catalog failed", () => {
    const p = setup({ status: { loading: false, error: "Could not load this edition's eulogies." } });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(p.onRetry).toHaveBeenCalled();
  });
});
