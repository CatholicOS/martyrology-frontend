import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@/test/intl";
import EulogyView from "@/components/EulogyView";

const { getElogium } = vi.hoisted(() => ({ getElogium: vi.fn() }));
vi.mock("@/lib/api", () => ({
  getElogium,
  ApiError: class ApiError extends Error {
    constructor(public status: number, public title: string) {
      super(title);
    }
  },
}));

import { ApiError } from "@/lib/api";
import itMsgs from "@/messages/it.json";

describe("EulogyView errors", () => {
  it("shows the translated unreachable message, not the route's English title, for a 502", async () => {
    getElogium.mockRejectedValue(new ApiError(502, "API unreachable"));
    render(<EulogyView id="mr:0101-x" baseEdition="mr_2004" locale="en" />, { locale: "it" });
    await waitFor(() => expect(screen.getByText(new RegExp(itMsgs.Errors.unreachable))).toBeInTheDocument());
    expect(screen.queryByText(/API unreachable/)).toBeNull();
  });

  it("still shows the raw title for other statuses", async () => {
    getElogium.mockRejectedValue(new ApiError(500, "Boom"));
    render(<EulogyView id="mr:0101-x" baseEdition="mr_2004" locale="en" />);
    await waitFor(() => expect(screen.getByText(/Boom/)).toBeInTheDocument());
  });
});
