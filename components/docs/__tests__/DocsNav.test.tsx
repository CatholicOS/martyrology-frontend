import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/docs/en/lunar-table" } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { DocsNav } from "@/components/docs/DocsNav";

describe("DocsNav", () => {
  it("lists both parts and marks the current page", () => {
    pathname.current = "/docs/en/lunar-table";
    render(<DocsNav lang="en" />);
    expect(screen.getByText("The Roman Martyrology")).toBeInTheDocument();
    expect(screen.getByText("The project")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "The lunar table" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "History of the Roman Martyrology" })).not.toHaveAttribute("aria-current");
  });

  it("switches language on the same page", () => {
    pathname.current = "/docs/en/lunar-table";
    render(<DocsNav lang="en" />);
    expect(screen.getByRole("link", { name: "Italiano" })).toHaveAttribute("href", "/docs/it/lunar-table");
  });

  it("switches language on the index to the other index", () => {
    pathname.current = "/docs/it";
    render(<DocsNav lang="it" />);
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/docs/en");
    expect(screen.getByRole("link", { name: "Documentazione" })).toHaveAttribute("aria-current", "page");
  });

  it("opens and closes the contents on phones", () => {
    pathname.current = "/docs/en/history";
    render(<DocsNav lang="en" />);
    const button = screen.getByRole("button", { name: "Contents" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
