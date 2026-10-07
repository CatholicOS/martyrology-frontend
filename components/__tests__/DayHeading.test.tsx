import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DayHeading from "@/components/DayHeading";
import type { Luna } from "@/lib/types";

const getDay = vi.fn();
vi.mock("@/lib/api", () => ({ getDay: (...a: unknown[]) => getDay(...a), ApiError: class extends Error {} }));

const LETTERS = "a b c d e f g h i k l m n p q r s t u A B C D E f F G H M N P".split(" ");
const luna = (year: number, column: number, age: number, pronuntiatio: string): Luna => ({
  rows: [17, 14],
  dominical_letter: "F",
  epactae: ["xxj"],
  tabula: LETTERS.map((letter, i) => ({ letter, epact: String(i), age: ((i + 9) % 30) + 1, printed: i === 25 ? 27 : null })),
  annuntiatio: { year, golden_number: 13, epact: "xj", letter: "l", column, age, pronuntiatio },
});

beforeEach(() => getDay.mockReset());

// The 2004 editions: no titulus (the heading is the date), rows of 19 and 12, two F (one red), no margin.
const luna2004 = (): Luna => ({
  ...luna(2026, 24, 26, "Luna vigesima sexta"),
  rows: [19, 12],
  dominical_letter: null,
  epactae: null,
  tabula: LETTERS.map((letter, i) => ({
    letter: i === 24 ? "F" : letter,
    epact: String(i),
    age: i + 1,
    printed: null,
    red: i === 24,
  })),
});

describe("DayHeading", () => {
  it("completes the heading's Luna with the year's age, the derivation on hover", () => {
    render(<DayHeading titulus="Pridie Nonas Augusti. Luna." edition="e" mm={8} dd={4} luna={luna(2026, 10, 20, "Luna vigesima")} />);
    const h = screen.getByRole("heading", { level: 2 });
    expect(h.textContent).toBe("Pridie Nonas Augusti. Luna vigesima.");
    expect(screen.getByText("vigesima")).toHaveAttribute("title", "2026: golden number 13, epact xj, letter l");
  });

  it("shows the table on demand, the year's column highlighted and misprints as printed", () => {
    render(<DayHeading titulus="Pridie Nonas Augusti. Luna." edition="e" mm={8} dd={4} luna={luna(2026, 10, 20, "Luna vigesima")} />);
    expect(screen.getByText("Lunar table").closest("details")).not.toHaveAttribute("open");
    const current = screen.getAllByRole("cell").find((c) => c.getAttribute("aria-current") === "true");
    expect(current?.textContent).toBe("20");
    const sic = screen.getByTitle("printed 27; by the computus 5");
    expect(sic.textContent).toBe("27*");
    expect(screen.getByText(/As printed; below it, the age by the computus/)).toBeInTheDocument();
    const computed = screen.getAllByRole("row").find((r) => r.className.includes("lunaComputed"));
    expect(Array.from(computed!.querySelectorAll("td")).map((td) => td.textContent).filter(Boolean)).toEqual(["5"]);
    expect(screen.getByText(/dominical letter F; new moon of epact xxj/)).toBeInTheDocument();
  });

  it("loads another year's announcement", async () => {
    getDay.mockResolvedValue({ luna: luna(2027, 21, 1, "Luna prima") });
    render(<DayHeading titulus="Pridie Nonas Augusti. Luna." edition="e" mm={8} dd={4} luna={luna(2026, 10, 20, "Luna vigesima")} />);
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2027" } });
    await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Pridie Nonas Augusti. Luna prima."));
    expect(getDay).toHaveBeenCalledWith("e", "08", "04", 2027);
  });

  it("is a plain heading without lunar data, and says so before the reform", () => {
    const { rerender } = render(<DayHeading titulus="The Fourth Day of August" />);
    expect(screen.getByRole("heading").textContent).toBe("The Fourth Day of August");
    expect(screen.queryByText("Lunar table")).toBeNull();
    rerender(<DayHeading key="old" titulus="Pridie Nonas Augusti. Luna." luna={{ ...luna(1500, 0, 1, ""), annuntiatio: null }} />);
    expect(screen.getByRole("heading").textContent).toBe("Pridie Nonas Augusti. Luna.");
    expect(screen.getByText(/no announcement before the Gregorian reform/)).toBeInTheDocument();
  });

  it("sets a 2004 table in its rows, its red F in red, the moon on a line of its own", () => {
    render(<DayHeading titulus="25 augusti" edition="e" mm={8} dd={25} luna={luna2004()} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("25 augusti");
    expect(screen.getByText("Luna", { exact: false, selector: "p" }).textContent).toBe("Luna vigesima sexta.");
    const letterRows = screen.getAllByRole("row").filter((_, i) => i % 2 === 0);
    expect(letterRows.map((r) => r.querySelectorAll("th").length)).toEqual([19, 12]);
    const red = screen.getAllByRole("columnheader").filter((th) => th.className.includes("lunaRed"));
    expect(red.map((th) => th.textContent)).toEqual(["F"]);
    expect(screen.queryByText(/In the margin/)).toBeNull();
  });
});
