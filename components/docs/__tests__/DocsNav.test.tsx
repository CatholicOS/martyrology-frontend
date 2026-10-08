import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/intl";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/docs/lunar-table" } }));
vi.mock("@/i18n/navigation", () => ({ usePathname: () => pathname.current, Link: ({ href, children, ...p }: { href: string | { pathname: string }; children?: React.ReactNode }) => <a href={typeof href === "string" ? href : href.pathname} {...p}>{children}</a> }));

import { DocsNav } from "@/components/docs/DocsNav";

describe("DocsNav", () => {
  it("lists both parts and marks the current page", () => {
    pathname.current = "/docs/lunar-table";
    render(<DocsNav />);
    expect(screen.getByText("The Roman Martyrology")).toBeInTheDocument();
    expect(screen.getByText("The project")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "The lunar table" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "The lunar table" })).toHaveAttribute("href", "/docs/lunar-table");
    expect(screen.getByRole("link", { name: "History of the Roman Martyrology" })).not.toHaveAttribute("aria-current");
  });

  it("names the pages in the interface language and marks the index", () => {
    pathname.current = "/docs";
    render(<DocsNav />, { locale: "it" });
    expect(screen.getByRole("link", { name: "Documentazione" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Documentazione" })).toHaveAttribute("href", "/docs");
    expect(screen.getByRole("link", { name: "La tavola lunare" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indice" })).toBeInTheDocument();
  });

  it("opens and closes the contents on phones", () => {
    pathname.current = "/docs/history";
    render(<DocsNav />);
    const button = screen.getByRole("button", { name: "Contents" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the contents on phones when another page opens", () => {
    pathname.current = "/docs/history";
    const { rerender } = render(<DocsNav />);
    fireEvent.click(screen.getByRole("button", { name: "Contents" }));
    pathname.current = "/docs/using";
    rerender(<DocsNav />);
    expect(screen.getByRole("button", { name: "Contents" })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the current page legible in dark mode", () => {
    pathname.current = "/docs/history";
    render(<DocsNav />);
    expect(screen.getByRole("link", { name: "History of the Roman Martyrology" }).className).toMatch(/dark:aria-\[current=page\]:text-/);
  });
});
