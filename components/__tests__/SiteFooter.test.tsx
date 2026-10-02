import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/SiteFooter";

describe("SiteFooter", () => {
  it("carries the foundation's copyright notice for the current year", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      `© ${new Date().getFullYear()} Catholic Digital Commons Foundation. All rights reserved.`,
    );
    expect(screen.getByRole("link", { name: "Catholic Digital Commons Foundation" })).toHaveAttribute(
      "href",
      "https://catholicdigitalcommons.org",
    );
  });
});
