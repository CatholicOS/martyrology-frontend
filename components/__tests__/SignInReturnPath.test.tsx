import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SignInReturnPath } from "@/components/SignInReturnPath";

describe("SignInReturnPath", () => {
  it("carries the current path and query in a redirectTo field", () => {
    window.history.pushState({}, "", "/it/docs?x=1");
    const { container } = render(<form><SignInReturnPath fallback="/it" /></form>);
    const input = container.querySelector("input[name=redirectTo]") as HTMLInputElement;
    expect(input.type).toBe("hidden");
    expect(input.value).toBe("/it/docs?x=1");
  });
});
