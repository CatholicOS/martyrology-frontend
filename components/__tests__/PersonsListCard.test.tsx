import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import OperationCard from "@/components/OperationCard";
import { isAdjudicable, type DecisionRecord, type SetPersonsOp } from "@/lib/changeset";
import { opEulogy } from "@/lib/subject-review";

vi.mock("@/components/EulogyView", () => ({ default: () => <div data-testid="eulogy" /> }));

// Invented names, never the copyrighted 2004 text.
const op: SetPersonsOp = {
  op: "set_persons",
  uid: "persons:mr:0101-felix-et-socii",
  id: "mr:0101-felix-et-socii",
  current: ["Felix"],
  unread: ["Fictiánis"],
  persons: [
    { name: "Felix" },
    { name: "Fictianus", it: "Fiziano", printed: "Fictiánis", alternatives: ["Fictianis"] },
    { name: "Paulus" },
  ],
  decision: null,
};
const UID = "persons:mr:0101-felix-et-socii";
const props = { locale: "la" as const, baseEdition: "martyrologium_romanum_2004" };
const card = (decision?: DecisionRecord, onDecide = vi.fn()) => (
  <OperationCard op={op} decision={decision} onDecide={onDecide} {...props} />
);

describe("PersonsListCard", () => {
  it("shows the names read, the forms not read and the drafted list", () => {
    render(card());
    expect(screen.getByText("Read now:")).toBeInTheDocument();
    expect(screen.getByText("Not read:")).toBeInTheDocument();
    expect(screen.getByText("Fictiánis")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toBe("Felix");
    expect(items[1]).toContain("Fictianus · Fiziano");
    expect(items[1]).toContain("from Fictiánis");
    expect(items[1]).toContain("or Fictianis");
    expect(items[2]).toBe("Paulus");
  });

  it("accepts the list, or keeps the names as read", () => {
    const onDecide = vi.fn();
    render(card(undefined, onDecide));
    fireEvent.click(screen.getByRole("button", { name: "Accept the list" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "accept" });
    fireEvent.click(screen.getByRole("button", { name: "Keep as read" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "reject" });
  });

  it("an edited list is one person per line, Latin | Italian", () => {
    const onDecide = vi.fn();
    render(card(undefined, onDecide));
    fireEvent.click(screen.getByRole("button", { name: "Edit the list" }));
    const box = screen.getByRole("textbox", { name: "One person per line, in printed order: Latin name | Italian form" });
    expect((box as HTMLTextAreaElement).value).toBe("Felix\nFictianus | Fiziano\nPaulus");
    fireEvent.change(box, { target: { value: "Felix\n\nFictianus | Fiziano\nPetrus |  \nPaulus" } });
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, {
      decision: "edit",
      edited: { persons: [{ name: "Felix" }, { name: "Fictianus", it: "Fiziano" }, { name: "Petrus" }, { name: "Paulus" }] },
    });
  });

  it("an edit equal to the draft is an accept; an empty list can't be saved", () => {
    const onDecide = vi.fn();
    render(card(undefined, onDecide));
    fireEvent.click(screen.getByRole("button", { name: "Edit the list" }));
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "accept" });
    fireEvent.click(screen.getByRole("button", { name: "Edit the list" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  \n" } });
    expect(screen.getByRole("button", { name: "Save edit" })).toBeDisabled();
  });

  it("a saved edit shows its list", () => {
    render(card({ decision: "edit", edited: { persons: [{ name: "Felix" }, { name: "Petrus", it: "Pietro" }] } }));
    expect(screen.getByText("Edited: Felix; Petrus · Pietro")).toBeInTheDocument();
  });

  it("is adjudicable and grouped under its eulogy", () => {
    expect(isAdjudicable(op)).toBe(true);
    expect(opEulogy(op)).toBe("mr:0101-felix-et-socii");
  });
});
