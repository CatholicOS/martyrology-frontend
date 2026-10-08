import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/intl";

const { viewerMock } = vi.hoisted(() => ({ viewerMock: vi.fn() }));
vi.mock("@/lib/viewer", () => ({ getViewer: viewerMock }));
vi.mock("@/components/AuthStatus", () => ({ AuthStatus: () => <span>auth</span> }));
vi.mock("@/i18n/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ replace: vi.fn() }), Link: ({ href, children, ...p }: { href: string | { pathname: string }; children?: React.ReactNode }) => <a href={typeof href === "string" ? href : href.pathname} {...p}>{children}</a> }));

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

  it("links the map for everyone, signed in or not", async () => {
    viewerMock.mockResolvedValue({ signedIn: false, curator: false });
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
  });

  it("links the docs for everyone, before the map", async () => {
    viewerMock.mockResolvedValue({ signedIn: false, curator: false });
    render(await SiteHeader());
    const links = screen.getAllByRole("link").map((a) => a.textContent);
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
    expect(links.indexOf("Docs")).toBe(links.indexOf("Map") - 1);
  });

  it("offers the language picker", async () => {
    viewerMock.mockResolvedValue({ signedIn: false, curator: false });
    render(await SiteHeader());
    expect(screen.getByRole("button", { name: "Language" })).toBeInTheDocument();
  });
});
