import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/intl";
import CuratorNotes from "@/components/CuratorNotes";

describe("CuratorNotes", () => {
  it("links the IDs a note names to their eulogies", () => {
    render(
      <CuratorNotes
        edition="martyrologium_romanum_1749"
        notes={[{ id: "mr:0220-eleutherius-et-socii", mark: "†", note: "Probably mr:0218-sadoth-et-socii.",
          anchor: "note-x", markAnchor: "note-x-mark", at: 0 }]}
      />,
    );
    expect(screen.getByRole("link", { name: "mr:0218-sadoth-et-socii" })).toHaveAttribute(
      "href", "/en/read/martyrologium_romanum_2004/02/18#mr:0218-sadoth-et-socii",
    );
  });

  it("links a Wikidata QID to its item in a new tab", () => {
    render(
      <CuratorNotes
        edition="martyrologium_romanum_2004"
        notes={[{ id: "mr:0930-gregorius-illuminator", mark: "†", note: "On Mount Sepuh (Q47530516).",
          anchor: "note-y", markAnchor: "note-y-mark", at: 0 }]}
      />,
    );
    const link = screen.getByRole("link", { name: "Q47530516" });
    expect(link).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q47530516");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
});
