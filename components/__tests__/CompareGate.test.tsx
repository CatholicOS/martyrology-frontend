import { describe, it, expect, vi, beforeEach } from "vitest";

const { viewerMock } = vi.hoisted(() => ({ viewerMock: vi.fn() }));
vi.mock("@/lib/viewer", () => ({ getViewer: viewerMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/components/ComparePage", () => ({ default: () => <p>compare ui</p> }));

import CompareRoute from "@/app/[locale]/compare/page";

const PARAMS = { params: Promise.resolve({ locale: "en" }) };

describe("/compare gate", () => {
  beforeEach(() => {
    viewerMock.mockReset();
  });

  it("is a 404 when signed out", async () => {
    viewerMock.mockResolvedValue({ signedIn: false, curator: false });
    await expect(CompareRoute(PARAMS)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a 404 for a signed-in reader without a curation role", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: false });
    await expect(CompareRoute(PARAMS)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders the compare UI for a curator", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: true });
    expect(await CompareRoute(PARAMS)).toBeTruthy();
  });
});
