import { describe, it, expect, vi, beforeEach } from "vitest";

const { viewerMock } = vi.hoisted(() => ({ viewerMock: vi.fn() }));
vi.mock("@/lib/viewer", () => ({ getViewer: viewerMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/components/ReviewPage", () => ({ default: () => <p>review ui</p> }));

import ReviewRoute from "@/app/review/page";

describe("/review gate", () => {
  beforeEach(() => {
    viewerMock.mockReset();
  });

  it("is a 404 when signed out", async () => {
    viewerMock.mockResolvedValue({ signedIn: false, curator: false });
    await expect(ReviewRoute()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a 404 for a signed-in reader without a curation role", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: false });
    await expect(ReviewRoute()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders the review UI for a curator", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: true });
    const el = await ReviewRoute();
    expect(el).toBeTruthy();
  });
});
