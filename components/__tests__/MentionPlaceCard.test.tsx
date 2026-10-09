import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/test/intl";
import type { EntityState } from "@/lib/entities-client";

const { state, mapSpy, setView } = vi.hoisted(() => ({
  state: { current: { status: "idle" } as EntityState }, mapSpy: vi.fn(), setView: vi.fn(),
}));
vi.mock("@/lib/entities-client", () => ({ useEntity: () => state.current, requestEntities: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, ...p }: { href: string; children?: React.ReactNode }) => <a href={`/en${href}`} {...p}>{children}</a> }));
vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("leaflet", () => {
  const layer = { addTo: () => layer };
  const L = {
    map: (...a: unknown[]) => { mapSpy(...a); return { setView, remove: vi.fn() }; },
    tileLayer: () => layer,
    circleMarker: () => layer,
  };
  return { default: L, ...L };
});

import MentionPlaceCard from "@/components/markup/MentionPlaceCard";
import type { PlacedMention } from "@/lib/mentions";

const caesarea: PlacedMention = {
  kind: "place", where: "text", start: 0, end: 21, form: "Cæsaréæ in Cappadócia", name: null, qid: "Q48338",
  key: "mr:0101-basilius|text|0", eulogy: "mr:0101-basilius",
};
const KAYSERI = { kind: "place" as const, labels: { en: "Kayseri", it: "Kayseri" }, label: "Kayseri", country: "TR", coords: [38.7, 35.5] as [number, number] };
const card = (locale: "en" | "it" | "de" = "en", m = caesarea) =>
  render(<MentionPlaceCard mention={m} edition="martyrologium_romanum_2004" lang="la" headingId="h" />, { locale });

describe("MentionPlaceCard", () => {
  beforeEach(() => {
    state.current = { status: "ready", entity: KAYSERI };
    mapSpy.mockReset();
    setView.mockReset();
  });

  it("names the place and its country in the interface language, with the printed form tagged", async () => {
    card("it");
    expect(screen.getByRole("heading")).toHaveTextContent("Kayseri (Turchia)");
    expect(screen.getByText("Cæsaréæ in Cappadócia")).toHaveAttribute("lang", "la");
    expect(screen.getByRole("link", { name: "Vedi sulla mappa" })).toHaveAttribute("href", "/en/map?edition=martyrologium_romanum_2004");
    expect(screen.getByRole("link", { name: "Wikidata" })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q48338");
    await waitFor(() => expect(mapSpy).toHaveBeenCalled());
  });

  it("tags an English fallback name", async () => {
    card("de");
    expect(screen.getByText("Kayseri")).toHaveAttribute("lang", "en");
    await waitFor(() => expect(mapSpy).toHaveBeenCalled());
  });

  it("draws the small map, with the zoom buttons only, once Leaflet has loaded", async () => {
    card();
    await waitFor(() => expect(mapSpy).toHaveBeenCalled());
    expect(mapSpy.mock.calls[0][1]).toMatchObject({ dragging: false, scrollWheelZoom: false, keyboard: false });
    expect(setView).toHaveBeenCalledWith([38.7, 35.5], 8);
    expect(screen.getByRole("group", { name: "Map of Kayseri" })).toBeInTheDocument();
  });

  it("shows a compact Esri credit; the full attribution is one toggle away and collapses again", async () => {
    card();
    await waitFor(() => expect(mapSpy).toHaveBeenCalled());
    expect(mapSpy.mock.calls[0][1]).toMatchObject({ attributionControl: false });
    expect(screen.getByText("© Esri")).toBeInTheDocument();
    expect(screen.queryByText(/Sources: Esri, HERE/)).toBeNull();
    const toggle = screen.getByRole("button", { name: "Map credits" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText(/Sources: Esri, HERE/)).toBeVisible();
    expect(screen.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(screen.queryByText(/Sources: Esri, HERE/)).toBeNull();
  });

  it("draws no map for a place without coordinates", () => {
    state.current = { status: "ready", entity: { ...KAYSERI, coords: null } };
    card();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("when the details fail: the printed form, the notice, and still the map link", () => {
    state.current = { status: "error" };
    card();
    expect(screen.getByRole("heading")).toHaveTextContent("Cæsaréæ in Cappadócia");
    expect(screen.getByText(/Details unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See on the map" })).toBeInTheDocument();
  });
});
