import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Cite } from "@/components/docs/Cite";

describe("Cite", () => {
  it("names the Praenotanda and the Ordo in English", () => {
    render(<p><Cite lang="en" n="29" /> <Cite lang="en" ordo n="11" /></p>);
    expect(screen.getByText("(Praenotanda, n. 29)")).toBeInTheDocument();
    expect(screen.getByText("(Ordo, n. 11)")).toBeInTheDocument();
  });

  it("names the Premesse and the Rito in Italian, and ranges as nn.", () => {
    render(<p><Cite lang="it" n="38-39" /> <Cite lang="it" ordo n="11" /></p>);
    expect(screen.getByText("(Premesse, nn. 38–39)")).toBeInTheDocument();
    expect(screen.getByText("(Rito, n. 11)")).toBeInTheDocument();
  });
});
