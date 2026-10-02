import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public status: number, public title: string) { super(title); }
  }
  return { getElogium: vi.fn(), ApiError };
});

import { getElogium, ApiError } from "@/lib/api";
import { usePlacements, __resetPlacements } from "@/lib/use-placements";

const placement = { day_printed: "10-05", entry: 3, asterisk: false, unnumbered: false, text: null };
const eulogy = (id: string) => ({ id, subject: {}, anchor_day: "10-05", deprecated: false, editions: { e1749: placement } });

beforeEach(() => {
  __resetPlacements();
  vi.mocked(getElogium).mockReset();
});

describe("usePlacements", () => {
  it("fetches each id once and returns its placements", async () => {
    vi.mocked(getElogium).mockImplementation(async (id: string) => eulogy(id));
    const { result, rerender } = renderHook(({ ids }) => usePlacements(ids), { initialProps: { ids: ["mr:a"] } });
    expect(result.current).toEqual({});
    await waitFor(() => expect(result.current).toEqual({ "mr:a": { e1749: placement } }));
    rerender({ ids: ["mr:a"] });
    expect(getElogium).toHaveBeenCalledTimes(1);
  });

  it("records an id the API does not know as printed nowhere", async () => {
    vi.mocked(getElogium).mockRejectedValue(new ApiError(404, "Not Found"));
    const { result } = renderHook(() => usePlacements(["mr:nope"]));
    await waitFor(() => expect(result.current).toEqual({ "mr:nope": {} }));
  });

  it("leaves a failed id unknown, and asks again on the next mount", async () => {
    vi.mocked(getElogium).mockRejectedValue(new ApiError(500, "Server Error"));
    const first = renderHook(() => usePlacements(["mr:a"]));
    await waitFor(() => expect(getElogium).toHaveBeenCalledTimes(1));
    expect(first.result.current).toEqual({});
    first.unmount();
    renderHook(() => usePlacements(["mr:a"]));
    await waitFor(() => expect(getElogium).toHaveBeenCalledTimes(2));
  });

  it("asks nothing for no ids", () => {
    const { result } = renderHook(() => usePlacements([]));
    expect(result.current).toEqual({});
    expect(getElogium).not.toHaveBeenCalled();
  });
});
