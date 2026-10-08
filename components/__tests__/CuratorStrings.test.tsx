import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import ReviewSummary from "@/components/ReviewSummary";
import CompareControls from "@/components/CompareControls";

describe("curator interface strings", () => {
  it("ReviewSummary shows its counts and exports", () => {
    const onExport = vi.fn();
    render(<ReviewSummary summary={{ accepted: 2, rejected: 1, edited: 0, undecided: 4 }} onExport={onExport} />);
    expect(screen.getByText("7").tagName).toBe("STRONG");
    expect(screen.getByText("2 accepted")).toBeTruthy();
    expect(screen.getByText("4 undecided")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export decisions" }));
    expect(onExport).toHaveBeenCalled();
  });

  it("CompareControls labels its selects", () => {
    render(
      <CompareControls editions={[]} editionA="" editionB="" onEditionAChange={() => {}} onEditionBChange={() => {}} month={null} onMonthChange={() => {}} />
    );
    expect(screen.getByText("All months")).toBeTruthy();
    expect(screen.getByLabelText("Edition A")).toBeTruthy();
  });
});
