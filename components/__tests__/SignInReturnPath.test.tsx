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

  it("reads the location at submit time, not just on mount", () => {
    window.history.pushState({}, "", "/en");
    const { container } = render(<form><SignInReturnPath fallback="/en" /></form>);
    window.history.pushState({}, "", "/en/read/mr:0101-x?a=b");
    const form = container.querySelector("form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const input = container.querySelector("input[name=redirectTo]") as HTMLInputElement;
    expect(input.value).toBe("/en/read/mr:0101-x?a=b");
  });
});
