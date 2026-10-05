import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import EulogyMap from "@/components/EulogyMap";
import type { MapEntry } from "@/lib/map-data";

type Fn = (...a: unknown[]) => void;
interface FakeMarker { latlng: [number, number]; popup?: HTMLElement; handlers: Record<string, Fn>; opened: number }
const groups: { layers: FakeMarker[]; handlers: Record<string, Fn>; opts: Record<string, unknown> }[] = [];
const fitBounds = vi.fn();
const remove = vi.fn();
const zoomToShowLayer = vi.fn((m: FakeMarker, cb: () => void) => cb());

vi.mock("leaflet", () => {
  const map = () => ({ fitBounds, setView: vi.fn(), remove });
  const tileLayer = () => ({ addTo: () => undefined });
  const circleMarker = (latlng: [number, number]) => {
    const m: FakeMarker & Record<string, unknown> = {
      latlng, handlers: {}, opened: 0,
      bindPopup(el: HTMLElement) { m.popup = el; return m; },
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
    };
    return g;
  };
  const L = { map, tileLayer, circleMarker, markerClusterGroup };
  return { default: L, ...L };
});
vi.mock("leaflet.markercluster", () => ({}));

const e = (id: string, qid: string, coords: [number, number]): MapEntry => ({
  id, subject: `Subject ${id}`, day: { mm: 1, dd: 2 }, entry: 1, qid, la: "Romæ", label: "Rome", country: "IT", coords, typology: "dies_natalis",
});
const entries = [e("mr:0102-a", "Q220", [41.9, 12.5]), e("mr:0102-b", "Q220", [41.9, 12.5]), e("mr:0102-c", "Q84", [51.5, -0.1])];

describe("EulogyMap", () => {
  beforeEach(() => {
    groups.length = 0;
    fitBounds.mockClear();
    remove.mockClear();
    zoomToShowLayer.mockClear();
  });

  it("puts one marker per eulogy in a cluster group and fits them", async () => {
    const { unmount } = render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    expect(groups[0].opts).toMatchObject({ zoomToBoundsOnClick: false, spiderfyOnMaxZoom: false });
    expect(fitBounds).toHaveBeenCalled();
    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("a marker's popup links to the eulogy in the reader", async () => {
    render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    const popup = groups[0].layers[0].popup!;
    expect(popup.textContent).toContain("Subject mr:0102-a");
    expect(popup.querySelector("a[data-read]")!.getAttribute("href")).toBe("/read/mr_2004/01/02#mr:0102-a");
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
    expect(onPlace).toHaveBeenCalledWith("Q220");
    expect(zoomToBounds).not.toHaveBeenCalled();
    groups[0].handlers.clusterclick({ layer: { getAllChildMarkers: () => [a, c], zoomToBounds } });
    expect(zoomToBounds).toHaveBeenCalled();
  });

  it("selecting a eulogy reveals and opens its marker", async () => {
    const { rerender } = render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    rerender(<EulogyMap entries={entries} edition="mr_2004" selected="mr:0102-c" onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(zoomToShowLayer).toHaveBeenCalled());
    expect(groups[0].layers[2].opened).toBe(1);
  });

  it("new entries replace the markers in the same group", async () => {
    const { rerender } = render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    rerender(<EulogyMap entries={entries.slice(2)} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0].layers).toHaveLength(1));
    expect(groups).toHaveLength(1);
  });
});
