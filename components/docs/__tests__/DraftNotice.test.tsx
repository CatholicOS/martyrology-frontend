import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/intl";
import { DraftNotice } from "@/components/docs/DraftNotice";
import { LOCALES } from "@/i18n/routing";
import { REVIEWED_DOC_LANGS } from "@/lib/docs";

describe("DraftNotice", () => {
  it("says the page is a draft translation and links to the contributing page in the reader's language", () => {
    render(<DraftNotice />, { locale: "fr" });
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(/draft translation awaiting review by native speakers/);
    expect(screen.getByRole("link", { name: "Help review it" })).toHaveAttribute("href", "/fr/docs/contributing");
  });

  it("is due on the fr/de/es/pt docs and not on the reviewed en/it ones", () => {
    expect(LOCALES.filter((l) => !REVIEWED_DOC_LANGS.includes(l))).toEqual(["fr", "de", "es", "pt"]);
  });
});
