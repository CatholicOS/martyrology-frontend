import { describe, it, expect } from "vitest";
import { buildUpstreamHeaders } from "@/lib/proxy-headers";

describe("buildUpstreamHeaders", () => {
  it("sends only accept when there is no token — the anonymous path is unchanged", () => {
    expect(buildUpstreamHeaders(undefined)).toEqual({ accept: "application/json" });
  });

  it("sends only accept when the token is null", () => {
    expect(buildUpstreamHeaders(null)).toEqual({ accept: "application/json" });
  });

  it("sends only accept when the token is an empty string", () => {
    expect(buildUpstreamHeaders("")).toEqual({ accept: "application/json" });
  });

  it("adds a bearer authorization header when a token is present", () => {
    expect(buildUpstreamHeaders("abc123")).toEqual({
      accept: "application/json",
      authorization: "Bearer abc123",
    });
  });
});
