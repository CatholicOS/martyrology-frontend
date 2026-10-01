import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthStatusView } from "@/components/AuthStatusView";

describe("AuthStatusView", () => {
  it("offers sign-in when there is no identity", () => {
    render(<AuthStatusView email={null} onSignIn={<button>Sign in</button>} onSignOut={<button>Sign out</button>} />);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("shows the identity and offers sign-out when signed in", () => {
    render(
      <AuthStatusView
        email="priest@johnromanodorazio.com"
        onSignIn={<button>Sign in</button>}
        onSignOut={<button>Sign out</button>}
      />,
    );
    expect(screen.getByText("priest@johnromanodorazio.com")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  it("warns when the session carries a refresh error", () => {
    render(
      <AuthStatusView
        email="priest@johnromanodorazio.com"
        error="RefreshAccessTokenError"
        onSignIn={<button>Sign in</button>}
        onSignOut={<button>Sign out</button>}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Session expired");
  });

  it("offers sign-in alongside sign-out when the session carries a refresh error", () => {
    render(
      <AuthStatusView
        email="priest@johnromanodorazio.com"
        error="RefreshAccessTokenError"
        onSignIn={<button>Sign in</button>}
        onSignOut={<button>Sign out</button>}
      />,
    );
    // The message says "sign in again"; the control to do so must be there.
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });
});
