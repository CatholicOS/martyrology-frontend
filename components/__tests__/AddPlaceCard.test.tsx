import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import OperationCard from "@/components/OperationCard";
import AddPlaceCard from "@/components/AddPlaceCard";
import type { AddPlaceOp } from "@/lib/changeset";

const { getElogium } = vi.hoisted(() => ({ getElogium: vi.fn() }));
vi.mock("@/lib/api", () => ({
  getElogium,
  ApiError: class ApiError extends Error {
    status = 0;
    title = "";
  },
}));

const LA = "Fictopoli, sanctorum Ficti et Fictitii, qui Romæ nati et Romæ sepulti sunt.";
const IT = "A Fictopoli, santi Fitto e Fittizio, nati a Roma e sepolti a Roma.";

function op(extra: Partial<AddPlaceOp> = {}): AddPlaceOp {
  return {
    op: "add_place", id: "mr:0101-ficti#burial#Romæ#2", eulogy: "mr:0101-ficti", role: "burial",
    la: "Romæ", it: "a Roma", occurrence: 2, occurrence_it: 2, confidence: "high",
    reasoning: "Buried there.", decision: null, persons: [{ name: "Fictus" }, { name: "Fictitius" }], ...extra,
  };
}

beforeEach(() => {
  getElogium.mockReset();
  getElogium.mockResolvedValue({
    id: "mr:0101-ficti", subject: {}, anchor_day: "01-01", deprecated: false,
    editions: { martyrologium_romanum_2004: { text: LA }, martyrologium_romanum_2004_it_IT: { text: IT } },
  });
});

describe("AddPlaceCard", () => {
  it("marks the chosen printing in both texts", async () => {
    render(<AddPlaceCard op={op()} onDecide={vi.fn()} />);
    const la = await screen.findByTestId("la-mark");
    expect(la.textContent).toBe("Romæ");
    expect(la.previousSibling?.textContent).toBe(LA.slice(0, LA.lastIndexOf("Romæ")));
    expect((await screen.findByTestId("it-mark")).previousSibling?.textContent).toBe(IT.slice(0, IT.lastIndexOf("a Roma")));
    expect(screen.getByText("burial")).toBeTruthy();
  });

  it("accepts and rejects", async () => {
    const onDecide = vi.fn();
    render(<AddPlaceCard op={op()} onDecide={onDecide} />);
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    expect(onDecide).toHaveBeenLastCalledWith(op().id, { decision: "accept" });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onDecide).toHaveBeenLastCalledWith(op().id, { decision: "reject" });
  });

  it("an edit sends only the changed fields", async () => {
    const onDecide = vi.fn();
    render(<AddPlaceCard op={op()} onDecide={onDecide} />);
    await screen.findByTestId("la-mark");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "death" } });
    fireEvent.change(screen.getByLabelText("Person"), { target: { value: "Fictitius" } });
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    expect(onDecide).toHaveBeenLastCalledWith(op().id, { decision: "edit", edited: { role: "death", person: "Fictitius" } });
  });

  it("clearing the Italian sends null", async () => {
    const onDecide = vi.fn();
    render(<AddPlaceCard op={op()} onDecide={onDecide} />);
    await screen.findByTestId("la-mark");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Italian"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    expect(onDecide).toHaveBeenLastCalledWith(op().id, { decision: "edit", edited: { it: null, occurrence_it: null } });
  });

  it("asks which printing and blocks a Latin form not printed", async () => {
    render(<AddPlaceCard op={op({ id: "x", la: "Fictopoli", occurrence: undefined, it: undefined, occurrence_it: undefined })} onDecide={vi.fn()} />);
    await screen.findByTestId("la-mark");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Latin"), { target: { value: "Romæ" } });
    expect(screen.getByRole("button", { name: "Save edit" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Latin printing"), { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "Save edit" })).toHaveProperty("disabled", false);
    fireEvent.change(screen.getByLabelText("Latin"), { target: { value: "Parisiis" } });
    expect(screen.getByText("Not printed in this text.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save edit" })).toHaveProperty("disabled", true);
  });

  it("OperationCard routes add_place here", async () => {
    render(<OperationCard op={op()} onDecide={vi.fn()} locale="la" baseEdition="martyrologium_romanum_2004" />);
    expect(await screen.findByTestId("la-mark")).toBeTruthy();
  });
});
