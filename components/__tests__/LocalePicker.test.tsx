import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@/test/intl";

const { nav } = vi.hoisted(() => ({ nav: { pathname: "/read/martyrologium_romanum_1630/01/02", replace: vi.fn() } }));
vi.mock("@/i18n/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ replace: nav.replace }) }));

import { LocalePicker, writeLocaleCookie } from "@/components/LocalePicker";

/** Opens the language list from the globe button, whatever its name in the current locale. */
function open() {
  fireEvent.click(screen.getByRole("button", { expanded: false }));
}

describe("LocalePicker", () => {
  beforeEach(() => {
    nav.replace.mockReset();
    document.cookie = "NEXT_LOCALE=; Max-Age=0; Path=/";
    window.history.replaceState(null, "", "/en/read/martyrologium_romanum_1630/01/02?with=x#mr:0102-telesphorus");
  });

  it("is a globe button named for the language setting, its list closed", () => {
    render(<LocalePicker />, { locale: "it" });
    const button = screen.getByRole("button", { name: "Lingua" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("lists the six languages in their own names, the current one marked", () => {
    render(<LocalePicker />, { locale: "it" });
    open();
    expect(screen.getByRole("button", { name: "Lingua" })).toHaveAttribute("aria-expanded", "true");
    const items = within(screen.getByRole("list")).getAllByRole("button");
    expect(items.map((o) => o.textContent)).toEqual(["English", "Italiano", "Français", "Deutsch", "Español", "Português"]);
    expect(items.map((o) => o.getAttribute("lang"))).toEqual(["en", "it", "fr", "de", "es", "pt"]);
    expect(screen.getByRole("button", { name: "Italiano" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "English" })).not.toHaveAttribute("aria-current");
  });

  it("saves the choice and opens the same page, query and hash in that language", () => {
    render(<LocalePicker />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Deutsch" }));
    expect(document.cookie).toContain("NEXT_LOCALE=de");
    expect(nav.replace).toHaveBeenCalledWith("/read/martyrologium_romanum_1630/01/02?with=x#mr:0102-telesphorus", { locale: "de" });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("closes without navigating when the current language is chosen", () => {
    render(<LocalePicker />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("drops the hash on docs pages, whose anchors differ by language", () => {
    nav.pathname = "/docs/reading-a-day";
    window.history.replaceState(null, "", "/en/docs/reading-a-day#asterisks");
    render(<LocalePicker />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Italiano" }));
    expect(nav.replace).toHaveBeenCalledWith("/docs/reading-a-day", { locale: "it" });
    nav.pathname = "/read/martyrologium_romanum_1630/01/02";
  });

  it("closes on Escape, returning focus to the globe, without the Escape reaching the page", () => {
    const onDocKey = vi.fn();
    document.addEventListener("keydown", onDocKey);
    render(<LocalePicker />);
    open();
    fireEvent.keyDown(screen.getByRole("button", { name: "English" }), { key: "Escape" });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Language" })).toHaveFocus();
    expect(onDocKey).not.toHaveBeenCalled();
    document.removeEventListener("keydown", onDocKey);
  });

  it("closes on a click outside", () => {
    render(<LocalePicker />);
    open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("writes a site-wide, year-long, Lax cookie (Secure on https)", () => {
    expect(writeLocaleCookie("fr", false)).toBe("NEXT_LOCALE=fr; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(writeLocaleCookie("fr", true)).toBe("NEXT_LOCALE=fr; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
  });
});
