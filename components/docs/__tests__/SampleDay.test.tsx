import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/intl";
import { SampleDay } from "@/components/docs/SampleDay";

describe("SampleDay", () => {
  it("shows an unnumbered lead, numbered entries and asterisked ones, by subject only", () => {
    render(<SampleDay />);
    expect(screen.getByText("Saints Basil the Great and Gregory Nazianzen")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
    expect(screen.getByText("4*.")).toBeInTheDocument();
    expect(screen.getByText("Blessed Marcolinus Amanni")).toBeInTheDocument();
  });

  it("names the subjects in Italian in the Italian interface", () => {
    render(<SampleDay />, { locale: "it" });
    expect(screen.getByText("San Telesforo")).toBeInTheDocument();
    expect(screen.getByText(/Il 2 gennaio/)).toBeInTheDocument();
  });

  it("falls back to the English subjects where crmedr has none in the interface language", () => {
    render(<SampleDay />, { locale: "fr" });
    expect(screen.getByText("Saint Telesphorus")).toBeInTheDocument();
  });
});
