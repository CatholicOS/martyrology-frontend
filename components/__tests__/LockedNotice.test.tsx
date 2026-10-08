import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/intl";
import LockedNotice from "@/components/LockedNotice";

describe("LockedNotice access info", () => {
  it("renders a bare URL as a link", () => {
    render(<LockedNotice title="T" signedIn accessInfo="https://example.org/x" onSignIn={() => {}} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.org/x");
  });
  it("links the URL within a sentence", () => {
    render(<LockedNotice title="T" signedIn accessInfo="Key needed. See https://example.org/x." onSignIn={() => {}} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.org/x");
    expect(screen.getByRole("status")).toHaveTextContent("Key needed. See https://example.org/x.");
  });
});
