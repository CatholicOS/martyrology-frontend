import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@/test/intl";
import PlaceMap from "@/components/PlaceMap";

type Handler = () => void;
const markers: { latlng: [number, number]; opts: Record<string, unknown>; click?: Handler; style: Record<string, unknown> }[] = [];
const fitBounds = vi.fn();
const setView = vi.fn();
const remove = vi.fn();

vi.mock("leaflet", () => {
  const map = () => ({ fitBounds, setView, remove });
  const tileLayer = () => ({ addTo: () => undefined });
  const circleMarker = (latlng: [number, number], opts: Record<string, unknown>) => {
    const m = {
      latlng,
      opts,
      style: { ...opts },
      click: undefined as Handler | undefined,
      addTo() {
        markers.push(m);
        return m;
      },
      bindTooltip() {
        return m;
      },
      on(_ev: string, fn: Handler) {
        m.click = fn;
        return m;
      },
      setStyle(s: Record<string, unknown>) {
        Object.assign(m.style, s);
        return m;
      },
    };
    return m;
  };
  return { default: { map, tileLayer, circleMarker }, map, tileLayer, circleMarker };
});

const points = [
  { wikidata: "Q1", label: "Fictopolis", coords: [45.1, 9.2] as [number, number] },
  { wikidata: "Q2", label: "Fictopolis Nova", coords: [38.0, 15.5] as [number, number] },
  { wikidata: "Q3", label: "Fictaria", coords: null },
];

describe("PlaceMap", () => {
  beforeEach(() => {
    markers.length = 0;
    fitBounds.mockClear();
    setView.mockClear();
    remove.mockClear();
  });

  it("plots each candidate with coordinates, highlights the selected one and selects on click", async () => {
    const onSelect = vi.fn();
    const { unmount } = render(<PlaceMap points={points} selected="Q1" onSelect={onSelect} />);
    await waitFor(() => expect(markers).toHaveLength(2));
    expect(markers.map((m) => m.latlng)).toEqual([[45.1, 9.2], [38.0, 15.5]]);
    expect(fitBounds).toHaveBeenCalled();
    const q1 = markers[0];
    const q2 = markers[1];
    expect(q1.style.color).not.toEqual(q2.style.color);
    q2.click?.();
    expect(onSelect).toHaveBeenCalledWith("Q2");
    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("a single point is centred instead of fitted", async () => {
    render(<PlaceMap points={[points[0]]} selected="Q1" onSelect={vi.fn()} />);
    await waitFor(() => expect(markers).toHaveLength(1));
    expect(setView).toHaveBeenCalledWith([45.1, 9.2], 9);
  });
});
