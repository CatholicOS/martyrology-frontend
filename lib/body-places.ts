import type { useTranslations } from "next-intl";
import type { MentionRole } from "@/lib/types";

/** The role a place plays in one eulogy (crmedr's ROLES in scripts/extract_places.py). */
export const PLACE_ROLES = [
  "death", "burial", "translation", "dedication", "cult", "birth", "education",
  "religious_life", "ministry", "foundation", "exile", "captivity", "journey", "mention",
] as const;

export type PlaceRole = (typeof PLACE_ROLES)[number];

/** Start offsets of the exact, non-overlapping printings of form in text (crmedr's `occurrences`). */
export function printings(text: string, form: string): number[] {
  const out: number[] = [];
  if (!form) return out;
  for (let i = text.indexOf(form); i >= 0; i = text.indexOf(form, i + form.length)) out.push(i);
  return out;
}

/** The nth printing (from 1) of form in text, or null. */
export function printingSpan(text: string, form: string, n?: number | null): { start: number; end: number } | null {
  const start = printings(text, form)[(n ?? 1) - 1];
  return start === undefined ? null : { start, end: start + form.length };
}

export type RolesT = ReturnType<typeof useTranslations<"PlaceRoles">>;

/** A role's label in the interface language; a role this site does not know yet, spelled out from its ID. */
export function roleLabel(t: RolesT, role: string): string {
  return t.has(role as PlaceRole) ? t(role as PlaceRole) : role.replace(/_/g, " ");
}

/** A role's label, with whose role it is when the eulogy says ("Place of ministry (Pionius)"). */
export function roleText(t: RolesT, r: MentionRole): string {
  const label = roleLabel(t, r.role);
  return r.name ? t("of", { role: label, name: r.n ? `${r.name} ${r.n}` : r.name }) : label;
}
