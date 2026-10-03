import { describe, it, expect } from "vitest";
import { splitText, describeRealign, currentTargets } from "@/lib/realign";
import { opId, isAdjudicable, type RealignOp } from "@/lib/changeset";

const TEXT =
  "Vigilia Nativitatis Domini nostri Jesu Christi. Cracoviae, in Polonia, natalis sancti Joannis Cantii, Presbyteri.";

describe("splitText", () => {
  it("gives the head to the first id and each part its own run", () => {
    const { segments, missing } = splitText(TEXT, "mr:1224-vigilia", [
      { split_at: "Cracoviae, in Polonia, natalis sancti", id: "mr:1224-ioannes-de-kety" },
    ]);
    expect(missing).toEqual([]);
    expect(segments).toEqual([
      { id: "mr:1224-vigilia", text: "Vigilia Nativitatis Domini nostri Jesu Christi." },
      { id: "mr:1224-ioannes-de-kety", text: "Cracoviae, in Polonia, natalis sancti Joannis Cantii, Presbyteri." },
    ]);
  });

  it("orders parts by position and reports a split point not in the text", () => {
    const { segments, missing } = splitText("A one. B two. C three.", "a", [
      { split_at: "C three", id: "c" },
      { split_at: "B two", id: "b" },
      { split_at: "D four", id: "d" },
    ]);
    expect(segments.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(missing.map((p) => p.id)).toEqual(["d"]);
  });

  it("drops an empty head when the text starts at a split point", () => {
    const { segments } = splitText("B two.", "a", [{ split_at: "B two", id: "b" }]);
    expect(segments).toEqual([{ id: "b", text: "B two." }]);
  });
});

const op: RealignOp = {
  op: "realign",
  uid: "link:1749:mr:0101-circumcisio-domini",
  id: "mr:0101-circumcisio-domini",
  edition: "1749",
  action: "link",
  same_eulogy_with: "mr:0101-maria-dei-genetrix",
  decision: null,
};

describe("realign ops", () => {
  it("are adjudicable and keyed by their uid", () => {
    expect(isAdjudicable(op)).toBe(true);
    expect(opId(op)).toBe("link:1749:mr:0101-circumcisio-domini");
    expect(opId({ ...op, uid: "" })).toBe("mr:0101-circumcisio-domini");
  });

  it("describe their action", () => {
    expect(describeRealign(op)).toBe("Link mr:0101-circumcisio-domini ⇄ mr:0101-maria-dei-genetrix (same_eulogy)");
    expect(describeRealign({ ...op, action: "rekey", new_id: "mr:0101-x", target: "new" })).toBe(
      "1749: key this text as mr:0101-x (new deprecated ID)"
    );
  });

  it("list the current IDs they point at, once each", () => {
    const isCurrent = (id: string) => id === "mr:0101-maria-dei-genetrix";
    expect(currentTargets({ ...op, new_id: "mr:0101-maria-dei-genetrix" }, isCurrent)).toEqual([
      "mr:0101-maria-dei-genetrix",
    ]);
  });
});
