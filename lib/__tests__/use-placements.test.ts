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
import type { EulogyOut } from "@/lib/types";

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

  it("adds the placements of the same eulogy printed on another day", async () => {
    const june = { day_printed: "06-10", entry: 9, asterisk: true, unnumbered: false, text: null };
    const december = { day_printed: "12-10", entry: 9, asterisk: true, unnumbered: false, text: null };
    vi.mocked(getElogium).mockImplementation(async (id: string): Promise<EulogyOut> => {
      if (id === "mr:0610-x") {
        return { id, subject: {}, anchor_day: "06-10", deprecated: false, editions: { la: june }, same_eulogy: ["mr:1210-x"] } as EulogyOut;
      } else {
        return { id, subject: {}, anchor_day: "12-10", deprecated: false, editions: { it: december }, same_eulogy: ["mr:0610-x"] } as EulogyOut;
      }
    });
    const { result } = renderHook(() => usePlacements(["mr:0610-x"]));
    await waitFor(() => expect(result.current).toEqual({ "mr:0610-x": { la: june, it: december } }));
  });

  it("keeps an edition's own placement over its twin's, and ignores a twin printed nowhere else", async () => {
    const own = { day_printed: "06-10", entry: 9, asterisk: true, unnumbered: false, text: null };
    vi.mocked(getElogium).mockImplementation(async (id: string): Promise<EulogyOut> => {
      if (id === "mr:0610-x") {
        return { id, subject: {}, anchor_day: "06-10", deprecated: false, editions: { la: own }, same_eulogy: ["mr:1210-x"] } as EulogyOut;
      } else {
        return { id, subject: {}, anchor_day: "12-10", deprecated: false, editions: {}, same_eulogy: ["mr:0610-x"] } as EulogyOut;
      }
    });
    const { result } = renderHook(() => usePlacements(["mr:0610-x"]));
    await waitFor(() => expect(result.current).toEqual({ "mr:0610-x": { la: own } }));
    expect(getElogium).toHaveBeenCalledTimes(2);
  });
});
