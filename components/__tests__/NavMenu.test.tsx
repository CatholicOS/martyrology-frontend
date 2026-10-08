import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen, MESSAGES } from "@/test/intl";
import { render as rawRender } from "@testing-library/react";
import type { Locale } from "@/i18n/routing";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => "/") }));
vi.mock("@/i18n/navigation", () => ({ usePathname: pathnameMock, Link: ({ href, children, ...p }: { href: string | { pathname: string }; children?: React.ReactNode }) => <a href={typeof href === "string" ? href : href.pathname} {...p}>{children}</a> }));

import { NavMenu } from "@/components/NavMenu";
import { Link } from "@/i18n/navigation";

function menu() {
  return render(
    <div>
      <NavMenu>
        <Link href="/map" onClick={(e) => e.preventDefault()}>
          Map
        </Link>
        <button type="button">Sign in</button>
      </NavMenu>
      <p>outside</p>
    </div>,
  );
}

describe("NavMenu", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/");
  });

  it("starts closed, with a button that controls the panel", () => {
    menu();
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    const nav = screen.getByRole("navigation", { hidden: true });
    expect(button).toHaveAttribute("aria-controls", nav.id);
    // closed below the breakpoint, a row from `sm` up
    expect(nav).toHaveClass("hidden", "sm:flex", "sm:flex-row");
  });

  it("opens the items as a vertical panel, sign-in included", () => {
    menu();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("flex", "flex-col");
    expect(nav).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Map" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  it("closes on Escape and returns focus to the button", () => {
    menu();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.keyDown(document, { key: "Escape" });
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("closes on a click outside, not on one inside", () => {
    menu();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("outside"));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when one of its links is followed", () => {
    menu();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("link", { name: "Map" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on navigation, and stays closed on returning to the page it was opened on", () => {
    const tree = () => (
      <div>
        <NavMenu>
          <Link href="/map" onClick={(e) => e.preventDefault()}>
            Map
          </Link>
          <button type="button">Sign in</button>
        </NavMenu>
        <p>outside</p>
      </div>
    );
    const { rerender } = render(tree());
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    pathnameMock.mockReturnValue("/map");
    rerender(tree());
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
    pathnameMock.mockReturnValue("/");
    rerender(tree());
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Back/Forward, which a query-only navigation may be", () => {
    menu();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent(window, new PopStateEvent("popstate"));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the language changes, though the locale-less pathname does not", () => {
    const tree = (locale: Locale) => (
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
        <NavMenu>
          <button type="button">Sign in</button>
        </NavMenu>
      </NextIntlClientProvider>
    );
    const { rerender } = rawRender(tree("en"));
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    rerender(tree("de"));
    expect(screen.getByRole("button", { name: /menu/i })).toHaveAttribute("aria-expanded", "false");
  });
});
