import { describe, it, expect, vi, beforeEach } from "vitest";

const { existsMock, viewerMock, metaMock } = vi.hoisted(() => ({ existsMock: vi.fn(), viewerMock: vi.fn(), metaMock: vi.fn() }));
vi.mock("@/lib/server-editions", () => ({ editionExists: existsMock, editionMeta: metaMock }));
vi.mock("@/lib/viewer", () => ({ getViewer: viewerMock }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/components/Reader", () => ({ default: () => null }));
vi.mock("@/components/TodayRedirect", () => ({ default: () => null }));

import DayRoute, { generateMetadata } from "@/app/read/[edition]/[mm]/[dd]/page";
import EditionRoute from "@/app/read/[edition]/page";

const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

describe("/read routes", () => {
  beforeEach(() => {
    existsMock.mockReset().mockResolvedValue(true);
    metaMock.mockReset().mockResolvedValue({ title: "Martyrologium Romanum", year: 1749 });
    viewerMock.mockReset().mockResolvedValue({ signedIn: false, curator: false });
  });

  it("404s on an invalid day", async () => {
    await expect(DayRoute(params({ edition: "martyrologium_romanum_1749", mm: "02", dd: "30" }))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(DayRoute(params({ edition: "martyrologium_romanum_1749", mm: "2", dd: "01" }))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s on an unknown edition", async () => {
    existsMock.mockResolvedValue(false);
    await expect(DayRoute(params({ edition: "nope", mm: "01", dd: "01" }))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(EditionRoute(params({ edition: "nope" }))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders a valid day, including 29 February", async () => {
    expect(await DayRoute(params({ edition: "martyrologium_romanum_1749", mm: "02", dd: "29" }))).toBeTruthy();
  });

  it("titles the page with the day and the edition", async () => {
    expect(await generateMetadata(params({ edition: "mr1749", mm: "10", dd: "02" }))).toEqual({
      title: "2 October — Martyrologium Romanum 1749",
    });
  });

  it("falls back to the edition id when the list is unreachable, and to a generic title for bad params", async () => {
    metaMock.mockResolvedValue(null);
    expect(await generateMetadata(params({ edition: "mr1749", mm: "10", dd: "02" }))).toEqual({ title: "2 October — mr1749" });
    expect(await generateMetadata(params({ edition: "mr1749", mm: "13", dd: "02" }))).toEqual({ title: "Martyrologium" });
  });
});
