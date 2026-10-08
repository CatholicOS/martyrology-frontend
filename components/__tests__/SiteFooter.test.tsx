import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/intl";
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

  it("names the API version and the CRMEDR commit being served, linked to their sources", () => {
    render(<SiteFooter versions={{ api: "0.11.8", crmedr: "de362d03dce96ef92811b55b2a335c38b717576f" }} />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("API v0.11.8 · CRMEDR de362d0");
    expect(screen.getByRole("link", { name: "API v0.11.8" })).toHaveAttribute(
      "href",
      "https://github.com/CatholicOS/martyrology-api/releases/tag/v0.11.8",
    );
    expect(screen.getByRole("link", { name: "CRMEDR de362d0" })).toHaveAttribute(
      "href",
      "https://github.com/CatholicOS/crmedr/commit/de362d03dce96ef92811b55b2a335c38b717576f",
    );
  });

  it("leaves the versions out when the API could not be asked", () => {
    render(<SiteFooter versions={null} />);
    expect(screen.queryByText(/API v/)).not.toBeInTheDocument();
  });
});
