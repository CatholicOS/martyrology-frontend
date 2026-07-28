import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OperationCard from "@/components/OperationCard";
import type { RenameOp } from "@/lib/changeset";
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

describe("OperationCard", () => {
  it("fetches the eulogy and shows Latin text + old→new, then reports accept decisions", async () => {
    vi.mocked(getElogium).mockResolvedValue(fixtureEulogy);
    const onDecide = vi.fn();

    render(<OperationCard op={renameOp} onDecide={onDecide} locale="la" />);

    await waitFor(() => {
      expect(screen.getByText(/Circumcisio Domini nostri Jesu Christi, et Octava Nativitatis ejusdem\./)).toBeInTheDocument();
    });

    expect(screen.getByText(renameOp.id)).toBeInTheDocument();
    expect(screen.getByText(renameOp.new_id)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /accept/i }));

    expect(onDecide).toHaveBeenCalledWith(renameOp.id, { decision: "accept" });
  });
});
