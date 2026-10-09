import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@/test/intl";
import EulogyMap from "@/components/EulogyMap";
import type { MapEntry } from "@/lib/map-data";

type Fn = (...a: unknown[]) => void;
interface FakeMarker { latlng: [number, number]; popup?: HTMLElement | (() => HTMLElement); handlers: Record<string, Fn>; opened: number }
const popupOf = (m: FakeMarker) => (typeof m.popup === "function" ? m.popup() : m.popup!);
const groups: { layers: FakeMarker[]; handlers: Record<string, Fn>; opts: Record<string, unknown> }[] = [];
const fitBounds = vi.fn();
const remove = vi.fn();
let zoom = 5;
const zoomToShowLayer = vi.fn((m: FakeMarker, cb: () => void) => cb());
const setView = vi.fn();
// What the cluster group shows for a marker: itself, or the cluster it is folded into.
let visibleParent: (m: FakeMarker) => unknown = (m) => m;
const popups: { latlng?: [number, number]; content?: HTMLElement }[] = [];

vi.mock("leaflet", () => {
  const map = () => ({ fitBounds, setView, remove, getZoom: () => zoom, getMaxZoom: () => 18 });
  const popup = () => {
    const p: { latlng?: [number, number]; content?: HTMLElement } & Record<string, unknown> = {
      setLatLng(l: [number, number]) { p.latlng = l; return p; },
      setContent(c: HTMLElement) { p.content = c; return p; },
      openOn() { popups.push(p); return p; },
    };
    return p;
  };
  const tileLayer = () => ({ addTo: () => undefined });
  const circleMarker = (latlng: [number, number]) => {
    const m: FakeMarker & Record<string, unknown> = {
      latlng, handlers: {}, opened: 0,
      bindPopup(el: HTMLElement | (() => HTMLElement)) { m.popup = el; return m; },
      on(ev: string, fn: Fn) { m.handlers[ev] = fn; return m; },
      openPopup() { m.opened++; return m; },
      getLatLng() {
        return { lat: latlng[0], lng: latlng[1], equals: (o: { lat: number; lng: number }) => o.lat === latlng[0] && o.lng === latlng[1] };
      },
      setStyle() { return m; },
    };
    return m;
  };
  const markerClusterGroup = (opts: Record<string, unknown>) => {
    const g = {
      layers: [] as FakeMarker[], handlers: {} as Record<string, Fn>, opts,
      addTo() { groups.push(g); return g; },
      addLayers(ls: FakeMarker[]) { g.layers.push(...ls); return g; },
      clearLayers() { g.layers.length = 0; return g; },
      on(ev: string, fn: Fn) { g.handlers[ev] = fn; return g; },
      zoomToShowLayer,
      getVisibleParent: (m: FakeMarker) => visibleParent(m),
    };
    return g;
  };
  const L = { map, tileLayer, circleMarker, markerClusterGroup, popup };
  return { default: L, ...L };
});
vi.mock("leaflet.markercluster", () => ({}));

const e = (id: string, qid: string, coords: [number, number]): MapEntry => ({
  id, subject: `Subject ${id}`, editionSubject: `Subject ${id}`, day: { mm: 1, dd: 2 }, entry: 1, qid, la: "Romæ", label: "Rome", labelLang: "en", labelEn: "Rome", country: "IT", coords, typology: "dies_natalis",
});
const entries = [e("mr:0102-a", "Q220", [41.9, 12.5]), e("mr:0102-b", "Q220", [41.9, 12.5]), e("mr:0102-c", "Q84", [51.5, -0.1])];

describe("EulogyMap", () => {
  beforeEach(() => {
    groups.length = 0;
    fitBounds.mockClear();
    remove.mockClear();
    zoomToShowLayer.mockClear();
    setView.mockClear();
    visibleParent = (m) => m;
    popups.length = 0;
    zoom = 5;
  });

  it("puts one marker per eulogy in a cluster group and fits them", async () => {
    const { unmount } = render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    expect(groups[0].opts).toMatchObject({ zoomToBoundsOnClick: false, spiderfyOnMaxZoom: false });
    // Chunked loading keeps adding a superseded set after clearLayers (markercluster 1.5.3).
    expect(groups[0].opts.chunkedLoading).toBeFalsy();
    expect(fitBounds).toHaveBeenCalled();
    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("a marker's popup links to the eulogy in the reader", async () => {
    render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    expect(typeof groups[0].layers[0].popup).toBe("function"); // built when opened, not per marker per keystroke
    const popup = popupOf(groups[0].layers[0]);
    expect(popup.textContent).toContain("Subject mr:0102-a");
    expect(popup.querySelector("a[data-read]")!.getAttribute("href")).toBe("/en/read/mr_2004/01/02#mr:0102-a");
  });

  it("the popup's link keeps the interface language", async () => {
    render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />, { locale: "it" });
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    expect(popupOf(groups[0].layers[0]).querySelector("a[data-read]")!.getAttribute("href")).toBe("/it/read/mr_2004/01/02#mr:0102-a");
  });

  it("the popup marks the printed place as Latin, and a place name that fell back to English as English", async () => {
    render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />, { locale: "it" });
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    const popup = popupOf(groups[0].layers[0]);
    expect(popup.querySelector('[lang="la"]')!.textContent).toBe("Romæ");
    expect(popup.querySelector('a[href^="https://www.wikidata.org/"]')!.getAttribute("lang")).toBe("en");
  });

  it("clicking a marker selects its eulogy", async () => {
    const onSelect = vi.fn();
    render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={onSelect} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    groups[0].layers[2].handlers.click();
    expect(onSelect).toHaveBeenCalledWith("mr:0102-c");
  });

  it("a cluster at one place lists that place; a mixed cluster zooms in", async () => {
    const onPlace = vi.fn();
    render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={onPlace} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    const [a, b, c] = groups[0].layers;
    const zoomToBounds = vi.fn();
    groups[0].handlers.clusterclick({ layer: { getAllChildMarkers: () => [a, b], zoomToBounds } });
    expect(onPlace).toHaveBeenCalledWith(["mr:0102-a", "mr:0102-b"]);
    expect(zoomToBounds).not.toHaveBeenCalled();
    groups[0].handlers.clusterclick({ layer: { getAllChildMarkers: () => [a, c], zoomToBounds } });
    expect(zoomToBounds).toHaveBeenCalled();
  });

  it("a cluster of different places at one point lists them all", async () => {
    const onPlace = vi.fn();
    const twin = [e("mr:0521-a", "Q48338", [38.7, 35.5]), e("mr:0521-b", "Q10439273", [38.7, 35.5])];
    render(<EulogyMap entries={twin} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={onPlace} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(2));
    const [a, b] = groups[0].layers;
    groups[0].handlers.clusterclick({ layer: { getAllChildMarkers: () => [a, b], zoomToBounds: vi.fn() } });
    expect(onPlace).toHaveBeenCalledWith(["mr:0521-a", "mr:0521-b"]);
  });

  it("a cluster that still holds several places at the deepest zoom lists them instead of zooming", async () => {
    const onPlace = vi.fn();
    const near = [e("mr:0101-rieti", "Q1", [42.4, 12.86]), e("mr:0101-sabina", "Q2", [42.4002, 12.8601])];
    render(<EulogyMap entries={near} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={onPlace} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(2));
    zoom = 18;
    const zoomToBounds = vi.fn();
    const [a, b] = groups[0].layers;
    groups[0].handlers.clusterclick({ layer: { getAllChildMarkers: () => [a, b], zoomToBounds } });
    expect(zoomToBounds).not.toHaveBeenCalled();
    expect(onPlace).toHaveBeenCalledWith(["mr:0101-rieti", "mr:0101-sabina"]);
  });

  it("selecting a eulogy whose marker is shown opens its popup", async () => {
    const { rerender } = render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    rerender(<EulogyMap entries={entries} edition="mr_2004" selected={{ id: "mr:0102-c", n: 1 }} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0].layers[2].opened).toBe(1));
    expect(zoomToShowLayer).not.toHaveBeenCalled();
  });

  it("selecting a eulogy folded into a cluster opens its popup at its place, without spiderfying the cluster", async () => {
    const { rerender } = render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    visibleParent = () => ({ cluster: true });
    rerender(<EulogyMap entries={entries} edition="mr_2004" selected={{ id: "mr:0102-a", n: 1 }} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(popups).toHaveLength(1));
    expect(popups[0].latlng).toEqual([41.9, 12.5]);
    expect(popups[0].content!.textContent).toContain("Subject mr:0102-a");
    expect(setView).toHaveBeenCalledWith([41.9, 12.5], expect.any(Number));
    expect(zoomToShowLayer).not.toHaveBeenCalled();
  });

  it("selecting the same eulogy again reopens its popup", async () => {
    const { rerender } = render(<EulogyMap entries={entries} edition="mr_2004" selected={{ id: "mr:0102-c", n: 1 }} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers[2]?.opened).toBe(1));
    rerender(<EulogyMap entries={entries} edition="mr_2004" selected={{ id: "mr:0102-c", n: 2 }} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0].layers[2].opened).toBe(2));
  });

  it("new entries replace the markers in the same group", async () => {
    const { rerender } = render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    rerender(<EulogyMap entries={entries.slice(2)} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0].layers).toHaveLength(1));
    expect(groups).toHaveLength(1);
  });
});
