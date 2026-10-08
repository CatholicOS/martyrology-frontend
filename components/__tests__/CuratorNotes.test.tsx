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
});
