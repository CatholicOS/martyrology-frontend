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
  ids: ["mr:0108-severinus-neapoli"],
  winner: "mr:0108-severinus",
  class: "M-merge",
  confidence: "low",
  reasoning: "same-day collision",
  decision: null,
};

const EULOGY_RE = /Circumcisio Domini nostri Jesu Christi, et Octava Nativitatis ejusdem\./;

describe("OperationCard", () => {
  it("fetches the eulogy and shows Latin text + old→new, then reports accept decisions", async () => {
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    const onDecide = vi.fn();

    render(
      <OperationCard op={renameOp} onDecide={onDecide} locale="la" baseEdition="martyrologium_romanum_1749" />
    );

    await waitFor(() => expect(screen.getByText(EULOGY_RE)).toBeInTheDocument());
    // id appears both in the eulogy panel and the proposal; new_id only in the proposal.
    expect(screen.getAllByText(renameOp.id).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(renameOp.new_id)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onDecide).toHaveBeenCalledWith(renameOp.id, { decision: "accept" });
  });

  it("shows BOTH the losing and winner eulogy for a merge op", async () => {
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    render(
      <OperationCard op={mergeOp} onDecide={vi.fn()} locale="la" baseEdition="martyrologium_romanum_1749" />
    );

    // two eulogy panels: the losing entry and the winner, each fetched by getElogium
    await waitFor(() => expect(screen.getAllByText(EULOGY_RE)).toHaveLength(2));
    expect(screen.getByText(/losing — will be removed/i)).toBeInTheDocument();
    expect(screen.getByText(/winner — kept/i)).toBeInTheDocument();
    expect(getElogium).toHaveBeenCalledWith("mr:0108-severinus-neapoli");
    expect(getElogium).toHaveBeenCalledWith("mr:0108-severinus");
    // both ids are rendered so the curator can tell the panels apart
    expect(screen.getAllByText("mr:0108-severinus-neapoli").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("mr:0108-severinus").length).toBeGreaterThanOrEqual(1);
  });

  it("edits a merge op with a winner field only (no new_id/subject_la)", async () => {
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    const onDecide = vi.fn();

    render(
      <OperationCard op={mergeOp} onDecide={onDecide} locale="la" baseEdition="martyrologium_romanum_1749" />
    );

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const winnerField = screen.getByLabelText(/winner/i) as HTMLInputElement;
    expect(winnerField).toBeInTheDocument();
    expect(winnerField.value).toBe("mr:0108-severinus");
    expect(screen.queryByLabelText(/new_id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/subject_la/i)).not.toBeInTheDocument();

    fireEvent.change(winnerField, { target: { value: "mr:0108-severinus-x" } });
    fireEvent.click(screen.getByRole("button", { name: /save edit/i }));
    expect(onDecide).toHaveBeenCalledWith("mr:0108-severinus-neapoli", {
      decision: "edit",
      edited: { winner: "mr:0108-severinus-x" },
    });
  });

  it("restores a previously-saved edit into the input (resume) instead of the proposal", () => {
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    render(
      <OperationCard
        op={renameOp}
        decision={{ decision: "edit", edited: { new_id: "mr:0101-fixed", subject_la: "Circumcisio Domini" } }}
        onDecide={vi.fn()}
        locale="la"
        baseEdition="martyrologium_romanum_1749"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const newIdField = screen.getByLabelText(/new_id/i) as HTMLInputElement;
    expect(newIdField.value).toBe("mr:0101-fixed");
    expect(newIdField.value).not.toBe(renameOp.new_id);
  });

  it("prefers the base edition's text and labels a fallback edition", async () => {
    // base edition present with text: shows it, labeled, no fallback warning
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    const { unmount } = render(
      <OperationCard op={renameOp} onDecide={vi.fn()} locale="la" baseEdition="martyrologium_romanum_1749" />
    );
    await waitFor(() => expect(screen.getByText(EULOGY_RE)).toBeInTheDocument());
    expect(screen.getByText("martyrologium_romanum_1749")).toBeInTheDocument();
    expect(screen.queryByText(/no .* placement/i)).not.toBeInTheDocument();
    unmount();

    // base edition absent: fall back to another edition, with an amber warning
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    render(
      <OperationCard op={renameOp} onDecide={vi.fn()} locale="la" baseEdition="martyrologium_romanum_1914" />
    );
    await waitFor(() => expect(screen.getByText(EULOGY_RE)).toBeInTheDocument());
    expect(
      screen.getByText(/no martyrologium_romanum_1914 placement — showing martyrologium_romanum_1749/)
    ).toBeInTheDocument();
  });
});
