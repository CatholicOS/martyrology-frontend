import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CompareDay from "@/components/CompareDay";
import type { CompareDayGroup } from "@/lib/compare";

vi.mock("@/lib/api", () => ({
  getElogium: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    title: string;
    constructor(status: number, title: string) {
      super(title);
      this.status = status;
      this.title = title;
    }
  },
}));

const group: CompareDayGroup = {
  day: "01-01",
  rows: [
    {
      id: "mr:0101-x",
      status: "both",
      color: "none",
      crossDay: false,
      subject: "Sanctus X",
      country: null,
      anchorDay: "01-01",
      entry: 1,
    },
    {
      id: "mr:0101-dep",
      status: "a-only",
      color: "red",
      crossDay: false,
      subject: "Sanctus Dep",
      country: "IT",
      anchorDay: "01-01",
      entry: 2,
    },
    {
      id: "mr:1229-y",
      status: "a-only",
      color: "green",
      crossDay: true,
      subject: "Sanctus Y",
      country: "FR",
      anchorDay: "12-29",
      entry: 3,
    },
  ],
  counts: { both: 1, aOnly: 2, bOnly: 0, red: 1, green: 1 },
};

describe("CompareDay", () => {
  it("renders a red row with the red background class", () => {
    render(<CompareDay group={group} />);
    const cell = screen.getByText("mr:0101-dep");
    const row = cell.closest("tr")!;
    expect(row.className).toContain("bg-red-100");
  });

  it("shows a cross-day badge with the anchor day for cross-day rows", () => {
    render(<CompareDay group={group} />);
    expect(screen.getByText(/cross-day: 12-29/)).toBeInTheDocument();
  });
});
