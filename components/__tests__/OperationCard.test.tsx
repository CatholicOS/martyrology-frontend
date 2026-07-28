import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OperationCard from "@/components/OperationCard";
import type { RenameOp, MergeOp } from "@/lib/changeset";
import type { EulogyOut } from "@/lib/types";

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

import { getElogium } from "@/lib/api";

const fixtureEulogy: EulogyOut = {
  id: "mr:0101-circumcisio-domini",
  subject: { la: "Circumcisio Domini", it: "Circoncisione del Signore", en: "Circumcision of the Lord" },
  anchor_day: "01-01",
  deprecated: false,
  editions: {
    martyrologium_romanum_1749: {
      day_printed: "01-01",
      entry: 1,
      asterisk: false,
      unnumbered: false,
      text: "Circumcisio Domini nostri Jesu Christi, et Octava Nativitatis ejusdem.",
    },
  },
};

const renameOp: RenameOp = {
  op: "rename",
  id: "mr:0101-circumcisio-domini",
  new_id: "mr:0101-circumcisio-domini-nostri-iesu-christi-et-octava-nativitatis-eiusdem",
  subject_la: "Circumcisio Domini nostri Jesu Christi et Octava Nativitatis ejusdem",
  class: "V-event-drift",
  confidence: "high",
  incipit: "Circumcisio Domini nostri Jesu Christi, et Octava Nativitatis ejusdem.",
  reasoning: "event",
  decision: null,
};

const mergeOp: MergeOp = {
  op: "merge",
  ids: ["a", "b"],
  winner: "a",
  class: "V-duplicate",
  confidence: "high",
  reasoning: "duplicate",
  decision: null,
};

describe("OperationCard", () => {
  it("fetches the eulogy and shows Latin text + old→new, then reports accept decisions", async () => {
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    const onDecide = vi.fn();

    render(
      <OperationCard
        op={renameOp}
        onDecide={onDecide}
        locale="la"
        baseEdition="martyrologium_romanum_1749"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Circumcisio Domini nostri Jesu Christi, et Octava Nativitatis ejusdem\./)).toBeInTheDocument();
    });

    expect(screen.getByText(renameOp.id)).toBeInTheDocument();
    expect(screen.getByText(renameOp.new_id)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /accept/i }));

    expect(onDecide).toHaveBeenCalledWith(renameOp.id, { decision: "accept" });
  });

  it("edits a merge op with a winner field only (no new_id/subject_la)", async () => {
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    const onDecide = vi.fn();

    render(
      <OperationCard
        op={mergeOp}
        onDecide={onDecide}
        locale="la"
        baseEdition="martyrologium_romanum_1749"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Circumcisio Domini nostri Jesu Christi, et Octava Nativitatis ejusdem\./)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const winnerField = screen.getByLabelText(/winner/i) as HTMLInputElement;
    expect(winnerField).toBeInTheDocument();
    expect(winnerField.value).toBe("a");
    expect(screen.queryByLabelText(/new_id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/subject_la/i)).not.toBeInTheDocument();

    fireEvent.change(winnerField, { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: /save edit/i }));

    expect(onDecide).toHaveBeenCalledWith("a+b", { decision: "edit", edited: { winner: "b" } });
  });

  it("restores a previously-saved edit into the input (resume) instead of the proposal", async () => {
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    const onDecide = vi.fn();

    render(
      <OperationCard
        op={renameOp}
        decision={{ decision: "edit", edited: { new_id: "mr:0101-circumcisio-domini", subject_la: "Circumcisio Domini" } }}
        onDecide={onDecide}
        locale="la"
        baseEdition="martyrologium_romanum_1749"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const newIdField = screen.getByLabelText(/new_id/i) as HTMLInputElement;
    // shows the saved correction, NOT the original proposal
    expect(newIdField.value).toBe("mr:0101-circumcisio-domini");
    expect(newIdField.value).not.toBe(renameOp.new_id);
  });

  it("prefers the base edition's text and labels a fallback edition", async () => {
    const onDecide = vi.fn();

    // Base edition present with text: shows it directly, labeled.
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    const { unmount } = render(
      <OperationCard
        op={renameOp}
        onDecide={onDecide}
        locale="la"
        baseEdition="martyrologium_romanum_1749"
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/Circumcisio Domini nostri Jesu Christi, et Octava Nativitatis ejusdem\./)).toBeInTheDocument();
    });
    expect(screen.getByText(/martyrologium_romanum_1749/)).toBeInTheDocument();
    expect(screen.queryByText(/no .* placement/i)).not.toBeInTheDocument();
    unmount();

    // Base edition absent: falls back to another edition and shows an amber warning.
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    render(
      <OperationCard
        op={renameOp}
        onDecide={onDecide}
        locale="la"
        baseEdition="martyrologium_romanum_1914"
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/Circumcisio Domini nostri Jesu Christi, et Octava Nativitatis ejusdem\./)).toBeInTheDocument();
    });
    expect(screen.getByText(/no martyrologium_romanum_1914 placement — showing martyrologium_romanum_1749/)).toBeInTheDocument();
  });
});
