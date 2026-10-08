import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/intl";
import { components } from "@/mdx-components";

const H2 = components.h2 as (p: { children?: React.ReactNode }) => React.ReactElement;
const A = components.a as (p: { href?: string; children?: React.ReactNode }) => React.ReactElement;

describe("the docs' MDX elements", () => {
  it("anchor a heading by its text, accents and markup included", () => {
    render(<H2>Gli <em>asterischi</em> è</H2>);
    const h = screen.getByRole("heading", { level: 2 });
    expect(h).toHaveAttribute("id", "gli-asterischi-e");
    expect(screen.getByRole("link")).toHaveAttribute("href", "#gli-asterischi-e");
  });

  it("open external links in place but mark them external", () => {
    render(<A href="https://github.com/CatholicOS/crmedr">crmedr</A>);
    expect(screen.getByRole("link", { name: "crmedr" })).toHaveAttribute("rel", "external");
  });

  it("keep internal links internal", () => {
    render(<A href="/docs/en/ids">IDs</A>);
    expect(screen.getByRole("link", { name: "IDs" })).toHaveAttribute("href", "/en/docs/en/ids");
    expect(screen.getByRole("link", { name: "IDs" })).not.toHaveAttribute("rel");
  });
});
