import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/intl";
import EulogyItemLink from "@/components/EulogyItemLink";

describe("EulogyItemLink", () => {
  it("links the item on Wikidata, labelled by its kind", () => {
    render(<EulogyItemLink item={{ wikidata: "Q85977003", kind: "group" }} />);
    const link = screen.getByRole("link", { name: "Group on Wikidata" });
    expect(link.getAttribute("href")).toBe("https://www.wikidata.org/wiki/Q85977003");
  });

  it("renders nothing for a eulogy without an item", () => {
    const { container } = render(<EulogyItemLink item={undefined} />);
    expect(container.textContent).toBe("");
  });
});
