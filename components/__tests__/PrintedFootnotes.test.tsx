import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/intl";
import PrintedFootnotes from "@/components/PrintedFootnotes";
import type { PageFootnote } from "@/lib/footnotes";

vi.mock("@/data/misprints-snapshot.json", () => ({
  default: [
    { id: "mr:0801-x", edition: "martyrologium_romanum_2004_it_IT", footnote: 1, printed: "e maria", intended: "e Maria" },
    { id: "mr:0801-x", edition: "martyrologium_romanum_2004_it_IT", printed: "Fitte", intended: "Fitta" },
  ],
}));

const note = (number: number): PageFootnote => ({
  mark: "32", after: "Nazareth", text: "I loro nomi sono: beate Maria Raimonda di Gesù e maria (Anna) Kukołowicz.",
  id: "mr:0801-x", at: 0, anchor: `fn-${number}`, markAnchor: `fn-${number}-mark`, marginalia: [], number, mentions: [],
});

describe("PrintedFootnotes, misprints", () => {
  it("sets [sic! expected: …] after a misprint of the footnote, not one of the eulogy's text", () => {
    render(<PrintedFootnotes notes={[note(1)]} edition="martyrologium_romanum_2004_it_IT" />);
    const item = screen.getByRole("complementary", { name: "Footnotes" }).querySelector("li")!;
    expect(item).toHaveTextContent("Gesù e maria [sic! expected: e Maria] (Anna) Kukołowicz.");
  });

  it("marks nothing in another footnote or another edition", () => {
    render(<PrintedFootnotes notes={[note(2)]} edition="martyrologium_romanum_2004_it_IT" />);
    expect(screen.queryByText(/sic!/)).toBeNull();
    render(<PrintedFootnotes notes={[note(1)]} edition="martyrologium_romanum_2004" />);
    expect(screen.queryByText(/sic!/)).toBeNull();
  });
});
