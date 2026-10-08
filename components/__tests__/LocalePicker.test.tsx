import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";

const { nav } = vi.hoisted(() => ({ nav: { pathname: "/read/martyrologium_romanum_1630/01/02", replace: vi.fn() } }));
vi.mock("@/i18n/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ replace: nav.replace }) }));

import { LocalePicker, writeLocaleCookie } from "@/components/LocalePicker";

describe("LocalePicker", () => {
  beforeEach(() => {
    nav.replace.mockReset();
    document.cookie = "NEXT_LOCALE=; Max-Age=0; Path=/";
    window.history.replaceState(null, "", "/en/read/martyrologium_romanum_1630/01/02?with=x#mr:0102-telesphorus");
  });

  it("lists the six languages in their own names, the current one selected", () => {
    render(<LocalePicker />, { locale: "it" });
    const select = screen.getByRole("combobox", { name: "Language" });
    expect(select).toHaveValue("it");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["English", "Italiano", "Français", "Deutsch", "Español", "Português"]);
  });

  it("saves the choice and opens the same page, query and hash in that language", () => {
    render(<LocalePicker />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "de" } });
    expect(document.cookie).toContain("NEXT_LOCALE=de");
    expect(nav.replace).toHaveBeenCalledWith("/read/martyrologium_romanum_1630/01/02?with=x#mr:0102-telesphorus", { locale: "de" });
  });

  it("drops the hash on docs pages, whose anchors differ by language", () => {
    nav.pathname = "/docs/reading-a-day";
    window.history.replaceState(null, "", "/en/docs/reading-a-day#asterisks");
    render(<LocalePicker />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "it" } });
    expect(nav.replace).toHaveBeenCalledWith("/docs/reading-a-day", { locale: "it" });
    nav.pathname = "/read/martyrologium_romanum_1630/01/02";
  });

  it("writes a site-wide, year-long, Lax cookie (Secure on https)", () => {
    expect(writeLocaleCookie("fr", false)).toBe("NEXT_LOCALE=fr; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(writeLocaleCookie("fr", true)).toBe("NEXT_LOCALE=fr; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
  });
});
