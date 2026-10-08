import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { getDay } = vi.hoisted(() => ({ getDay: vi.fn() }));
vi.mock("@/lib/api", () => ({ getDay }));

import { LunarFinder } from "@/components/docs/LunarFinder";

const day2005 = {
  luna: { annuntiatio: { year: 2005, golden_number: 11, epact: "XIX", letter: "u", column: 0, age: 20, pronuntiatio: "Luna vigesima" } },
};

function pick(value: string) {
  fireEvent.change(screen.getByLabelText("Date"), { target: { value } });
}

describe("LunarFinder", () => {
  beforeEach(() => getDay.mockReset());

  it("shows the year's golden number, epact and letter, and the day's moon", async () => {
    getDay.mockResolvedValue(day2005);
    render(<LunarFinder lang="en" />);
    pick("2005-01-01");
    expect(getDay).toHaveBeenCalledWith("martyrologium_romanum_2004", "01", "01", 2005);
    expect(await screen.findByText("11")).toBeInTheDocument();
    expect(screen.getByText("XIX")).toBeInTheDocument();
    expect(screen.getByText("u")).toBeInTheDocument();
    expect(screen.getByText("Luna vigesima")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reader/i })).toHaveAttribute("href", "/read/martyrologium_romanum_2004/01/01");
  });

  it("asks for nothing while the date is empty or incomplete", () => {
    render(<LunarFinder lang="en" />);
    pick("");
    pick("0000-01-01");
    expect(getDay).not.toHaveBeenCalled();
  });

  it("says when the moon couldn't be loaded, and drops the previous answer", async () => {
    getDay.mockResolvedValueOnce(day2005).mockRejectedValueOnce(new Error("502"));
    render(<LunarFinder lang="en" />);
    pick("2005-01-01");
    expect(await screen.findByText("XIX")).toBeInTheDocument();
    pick("2006-01-01");
    expect(await screen.findByText(/couldn.t be loaded/)).toBeInTheDocument();
    expect(screen.queryByText("XIX")).not.toBeInTheDocument();
  });

  it("ignores an answer that arrives after a newer date was picked", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    getDay.mockReturnValueOnce(new Promise((r) => (resolveFirst = r))).mockResolvedValueOnce({
      luna: { annuntiatio: { ...day2005.luna.annuntiatio, year: 2006, golden_number: 12, epact: "*", letter: "P" } },
    });
    render(<LunarFinder lang="en" />);
    pick("2005-01-01");
    pick("2006-01-01");
    expect(await screen.findByText("P")).toBeInTheDocument();
    resolveFirst(day2005);
    await waitFor(() => expect(screen.queryByText("XIX")).not.toBeInTheDocument());
  });

  it("asks for nothing while a year is still being typed, nor before the table begins in 1583", () => {
    render(<LunarFinder lang="en" />);
    for (const v of ["0002-01-01", "0020-01-01", "0201-01-01", "1582-12-31"]) pick(v);
    expect(getDay).not.toHaveBeenCalled();
    expect(screen.getByText(/from 1583/)).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("says so when the API announces no moon for the date", async () => {
    getDay.mockResolvedValue({ luna: { annuntiatio: null } });
    render(<LunarFinder lang="en" />);
    pick("2005-01-01");
    expect(await screen.findByText(/no moon/i)).toBeInTheDocument();
  });
});
