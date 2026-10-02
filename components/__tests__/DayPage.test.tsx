import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DayPage from "@/components/DayPage";

const day = {
  titulus: "2 Octobris Sexto Nonas Octobris. xxj. B",
  elogia: [
    { id: "mr:1002-angeli-custodes", entry: 1, asterisk: false, unnumbered: true, anchor_day: "10-02", text: "Festum sanctorum Angelorum Custodum." },
    { id: "mr:1002-modestus-sardus", entry: 2, asterisk: false, unnumbered: false, anchor_day: "10-02", text: "Romae passio sancti Modesti Sardi." },
    { id: "mr:1002-x", entry: 3, asterisk: true, unnumbered: false, anchor_day: "10-02", text: "Alibi sancti X." },
  ],
  conclusio: "Et alibi aliorum plurimorum sanctorum Martyrum. R. Deo gratias.",
};

describe("DayPage", () => {
  it("uses the edition's titulus as the heading", () => {
    render(<DayPage day={day} heading="2 Octobris" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2 Octobris Sexto Nonas Octobris. xxj. B");
  });

  it("falls back to the computed heading when the edition prints no titulus", () => {
    render(<DayPage day={{ ...day, titulus: null }} heading="2 ottobre" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2 ottobre");
  });

  it("prints numbers and asterisks as rubrics, and headers unnumbered", () => {
    render(<DayPage day={day} heading="" />);
    const header = screen.getByText("Festum sanctorum Angelorum Custodum.");
    expect(header.closest("p")).toHaveAttribute("data-unnumbered", "true");
    expect(header.closest("p")).not.toHaveTextContent(/^1/);
    expect(screen.getByText("Romae passio sancti Modesti Sardi.").closest("p")).toHaveTextContent(/^2\s*Romae/);
    expect(screen.getByText("Alibi sancti X.").closest("p")).toHaveTextContent(/^\*\s*3\s*Alibi/);
  });

  it("closes with the conclusio, setting R. as a rubric, and omits an empty one", () => {
    const { rerender } = render(<DayPage day={day} heading="" />);
    expect(screen.getByText("R.")).toBeInTheDocument();
    rerender(<DayPage day={{ ...day, conclusio: "" }} heading="" />);
    expect(screen.queryByText("R.")).not.toBeInTheDocument();
  });
});
