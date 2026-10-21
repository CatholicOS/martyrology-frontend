import type { DecisionRecord, ResolvePlaceOp } from "@/lib/changeset";

const QID = /^Q[1-9]\d*$/;
const ISO = /^[A-Z]{2}$/;

/** What a place card's accept means (crmedr `build_gazetteer._resolve`): the suggestion, else the top candidate. */
export function placeDefaultQid(op: ResolvePlaceOp): string {
  return op.suggested?.wikidata ?? op.candidates[0]?.wikidata ?? "";
}

/**
 * The country a place card starts with for an item: the suggestion's for the suggested item, else the
 * candidate's; for a candidate in several countries (Frisia), its codes as the card writes them ("NL, DE").
 */
export function placeCountryFor(op: ResolvePlaceOp, qid: string): string {
  if (op.suggested && op.suggested.wikidata === qid) return op.suggested.countries?.join(", ") ?? op.suggested.country ?? "";
  const c = op.candidates.find((x) => x.wikidata === qid);
  if (!c) return "";
  return c.country ?? (c.countries.length > 1 ? c.countries.join(", ") : "");
}

/** The codes a place card's country field holds: one, or several separated by commas or spaces. */
export function countryCodes(field: string): string[] {
  return field.toUpperCase().split(/[\s,]+/).filter(Boolean);
}

/**
 * What taking Jev's place suggestion records; null when it cannot be applied as written
 * (no decision, a pick without a country or outside the candidates, a reject without a reason).
 * An accept is a plain accept only when the item and its country are the card's defaults.
 */
export function placeJevRecord(op: ResolvePlaceOp): DecisionRecord | null {
  const jev = op.jev;
  if (!jev?.decision) return null;
  if (jev.decision === "reject") {
    return jev.reason ? { decision: "reject", edited: { reason: jev.reason } } : null;
  }
  if (placeJevBlock(op)) return null;
  const qid = jev.wikidata!;
  const country = jev.country!;
  if (qid === placeDefaultQid(op) && country === placeCountryFor(op, qid)) return { decision: "accept" };
  return { decision: "edit", edited: { wikidata: qid, country } };
}

/**
 * Why Jev's suggestion cannot be taken as written, the same checks as the card's own accept:
 * a pick outside the candidates (or not a QID), a pick without a valid country, a reject without
 * a reason; null when it can be taken, or when there is no decision to take.
 */
export function placeJevBlock(op: ResolvePlaceOp): "not_listed" | "no_country" | "no_reason" | null {
  const jev = op.jev;
  if (!jev?.decision) return null;
  if (jev.decision === "reject") return jev.reason ? null : "no_reason";
  const qid = jev.wikidata;
  if (!qid || !QID.test(qid) || !op.candidates.some((c) => c.wikidata === qid)) return "not_listed";
  if (!jev.country || !ISO.test(jev.country)) return "no_country";
  return null;
}
