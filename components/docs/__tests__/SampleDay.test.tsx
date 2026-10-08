import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SampleDay } from "@/components/docs/SampleDay";

describe("SampleDay", () => {
  it("shows an unnumbered lead, numbered entries and asterisked ones, by subject only", () => {
    render(<SampleDay lang="en" />);
    expect(screen.getByText("Saints Basil the Great and Gregory Nazianzen")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
    expect(screen.getByText("4*.")).toBeInTheDocument();
    expect(screen.getByText("Blessed Marcolinus Amanni")).toBeInTheDocument();
  });

  it("names the subjects in Italian on Italian pages", () => {
    render(<SampleDay lang="it" />);
    expect(screen.getByText("San Telesforo")).toBeInTheDocument();
  });
});
