import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { __resetReaderSwitches, useMarkupSwitch, useReaderSwitch } from "@/lib/use-reader-switch";
import { useShowIds } from "@/lib/use-show-ids";

function Both() {
  const [ids, setIds] = useShowIds();
  const [markup, setMarkup] = useMarkupSwitch();
  return (
    <>
      <button onClick={() => setIds(!ids)}>ids {String(ids)}</button>
      <button onClick={() => setMarkup(!markup)}>markup {String(markup)}</button>
    </>
  );
}

describe("useReaderSwitch", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetReaderSwitches();
  });

  it("starts off, and each switch keeps its own state in its own key", () => {
    render(<Both />);
    fireEvent.click(screen.getByText("markup false"));
    expect(screen.getByText("markup true")).toBeInTheDocument();
    expect(screen.getByText("ids false")).toBeInTheDocument();
    expect(window.localStorage.getItem("reader.markup")).toBe("1");
    expect(window.localStorage.getItem("reader.showIds")).toBeNull();
  });

  it("remembers a switch across visits", () => {
    window.localStorage.setItem("reader.showIds", "1");
    render(<Both />);
    expect(screen.getByText("ids true")).toBeInTheDocument();
  });

  it("follows another tab flipping it", () => {
    function One() {
      const [on] = useReaderSwitch("reader.markup");
      return <p>{String(on)}</p>;
    }
    render(<One />);
    act(() => {
      window.localStorage.setItem("reader.markup", "1");
      window.dispatchEvent(new StorageEvent("storage", { key: "reader.markup" }));
    });
    expect(screen.getByText("true")).toBeInTheDocument();
  });
});
