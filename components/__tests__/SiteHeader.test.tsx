import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { viewerMock } = vi.hoisted(() => ({ viewerMock: vi.fn() }));
vi.mock("@/lib/viewer", () => ({ getViewer: viewerMock }));
vi.mock("@/components/AuthStatus", () => ({ AuthStatus: () => <span>auth</span> }));

import { SiteHeader } from "@/components/SiteHeader";

describe("SiteHeader", () => {
  beforeEach(() => {
    viewerMock.mockReset();
  });

  it("links home, and hides Compare and Review from non-curators", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: false });
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: "Martyrology" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Compare" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review" })).not.toBeInTheDocument();
  });

  it("shows Review to curators", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: true });
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute("href", "/review");
  });
});
