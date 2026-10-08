import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import OperationCard from "@/components/OperationCard";
import type { RealignOp } from "@/lib/changeset";

vi.mock("@/lib/api", () => ({ getElogium: vi.fn(), ApiError: class extends Error {} }));

const split: RealignOp = {
  op: "realign",
  uid: "split:1749:mr:1224-vigilia-nativitatis-domini",
  id: "mr:1224-vigilia-nativitatis-domini",
  edition: "1749",
  action: "split",
  class: "runin",
  confidence: "high",
  first_id: "mr:1224-vigilia-nativitatis-domini",
  parts: [{ split_at: "Cracoviae, in Polonia, natalis sancti", id: "mr:1224-ioannes-de-kety", target: "current" }],
  explanation: "John of Kęty is run into the vigil.",
  texts: {
    "mr:1224-vigilia-nativitatis-domini": {
      "1749": "Vigilia Nativitatis Domini nostri Jesu Christi. Cracoviae, in Polonia, natalis sancti Joannis Cantii.",
      "1914": "The Vigil of the Nativity of our Lord Jesus Christ.",
    },
  },
  decision: null,
};

describe("RealignCard", () => {
  it("shows the run-in text cut at its split point, each part with its ID", () => {
    render(<OperationCard op={split} onDecide={vi.fn()} locale="la" baseEdition="martyrologium_romanum_1749" />);
    expect(screen.getByText("Vigilia Nativitatis Domini nostri Jesu Christi.")).toBeInTheDocument();
    expect(screen.getByText("Cracoviae, in Polonia, natalis sancti Joannis Cantii.")).toBeInTheDocument();
    expect(screen.getAllByText("mr:1224-ioannes-de-kety").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1749: split into 2 eulogies")).toBeInTheDocument();
    // the other edition's text under the same key is available for comparison
    expect(screen.getByText("The Vigil of the Nativity of our Lord Jesus Christ.")).toBeInTheDocument();
  });

  it("records accept under the op's uid", () => {
    const onDecide = vi.fn();
    render(<OperationCard op={split} onDecide={onDecide} locale="la" baseEdition="martyrologium_romanum_1749" />);
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onDecide).toHaveBeenCalledWith(split.uid, { decision: "accept" });
  });

  it("saves an edited split point as an edit", () => {
    const onDecide = vi.fn();
    render(<OperationCard op={split} onDecide={onDecide} locale="la" baseEdition="martyrologium_romanum_1749" />);
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByLabelText("id 2"), { target: { value: "mr:1224-ioannes-cantius" } });
    fireEvent.click(screen.getByRole("button", { name: /save edit/i }));
    expect(onDecide).toHaveBeenCalledWith(split.uid, {
      decision: "edit",
      edited: {
        action: "split",
        first_id: "mr:1224-vigilia-nativitatis-domini",
        parts: [
          { split_at: "Cracoviae, in Polonia, natalis sancti", id: "mr:1224-ioannes-cantius", target: "current" },
        ],
      },
    });
  });

  it("records clearing a proposed link as an empty same_eulogy_with", () => {
    const onDecide = vi.fn();
    const link: RealignOp = { ...split, uid: "link:1749:x", action: "link", same_eulogy_with: "mr:1223-ioannes-de-kety" };
    render(<OperationCard op={link} onDecide={onDecide} locale="la" baseEdition="martyrologium_romanum_1749" />);
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByPlaceholderText("mr:MMDD-…"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save edit/i }));
    expect(onDecide).toHaveBeenCalledWith("link:1749:x", { decision: "edit", edited: { action: "link", same_eulogy_with: "" } });
  });
});
