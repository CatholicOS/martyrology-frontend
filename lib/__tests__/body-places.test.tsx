import { describe, it, expect } from "vitest";
import { useTranslations } from "next-intl";
import { render, screen } from "@/test/intl";
import { PLACE_ROLES, printings, printingSpan, roleText } from "@/lib/body-places";
import type { MentionRole } from "@/lib/types";

describe("body places", () => {
  it("lists the fourteen roles, captivity after exile", () => {
    expect(PLACE_ROLES).toHaveLength(14);
    expect(PLACE_ROLES.slice(10, 12)).toEqual(["exile", "captivity"]);
    expect(PLACE_ROLES[0]).toBe("death");
    expect(PLACE_ROLES).toContain("religious_life");
  });

  it("finds exact, non-overlapping printings", () => {
    expect(printings("Romæ natus, Romæ sepultus", "Romæ")).toEqual([0, 12]);
    expect(printings("aaaa", "aa")).toEqual([0, 2]);
    expect(printings("Romæ", "")).toEqual([]);
  });

  it("gives the nth printing's span", () => {
    expect(printingSpan("Romæ natus, Romæ sepultus", "Romæ", 2)).toEqual({ start: 12, end: 16 });
    expect(printingSpan("Romæ natus", "Romæ")).toEqual({ start: 0, end: 4 });
    expect(printingSpan("Romæ natus", "Romæ", 2)).toBeNull();
    expect(printingSpan("Romæ natus", "Parisiis")).toBeNull();
  });
});

function Probe({ r }: { r: MentionRole }) {
  const t = useTranslations("PlaceRoles");
  return <p>{roleText(t, r)}</p>;
}

describe("roleText", () => {
  it("labels a role, with whose when given", () => {
    render(
      <>
        <Probe r={{ role: "birth" }} />
        <Probe r={{ role: "captivity" }} />
        <Probe r={{ role: "ministry", name: "Pionius" }} />
        <Probe r={{ role: "burial", name: "Felix", n: 2 }} />
      </>
    );
    expect(screen.getByText("Place of birth")).toBeInTheDocument();
    expect(screen.getByText("Place of captivity")).toBeInTheDocument();
    expect(screen.getByText("Place of ministry (Pionius)")).toBeInTheDocument();
    expect(screen.getByText("Place of burial (Felix 2)")).toBeInTheDocument();
  });

  it("an unknown role is spelled out", () => {
    render(<Probe r={{ role: "pilgrimage_site" }} />);
    expect(screen.getByText("pilgrimage site")).toBeInTheDocument();
  });
});
