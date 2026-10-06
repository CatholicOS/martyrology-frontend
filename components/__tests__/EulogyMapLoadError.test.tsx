import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EulogyMap from "@/components/EulogyMap";

// A Leaflet chunk that fails to load (offline, or a deploy replaced it).
vi.mock("leaflet", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

describe("EulogyMap when Leaflet cannot load", () => {
  it("says so and offers a reload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<EulogyMap entries={[]} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    expect(await screen.findByText("The map could not load.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
