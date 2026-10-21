import type { DecisionRecord, ResolvePlaceOp } from "@/lib/changeset";

/** What a place card's accept means (crmedr `build_gazetteer._resolve`): the suggestion, else the top candidate. */
export function placeDefaultQid(op: ResolvePlaceOp): string {
  return op.suggested?.wikidata ?? op.candidates[0]?.wikidata ?? "";
}

/** The country a place card starts with for an item: the suggestion's for the suggested item, else the candidate's. */
export function placeCountryFor(op: ResolvePlaceOp, qid: string): string {
  if (op.suggested && op.suggested.wikidata === qid) return op.suggested.country;
  return op.candidates.find((c) => c.wikidata === qid)?.country ?? "";
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
  const qid = jev.wikidata;
  const country = jev.country;
  if (!qid || !country || !op.candidates.some((c) => c.wikidata === qid)) return null;
  if (qid === placeDefaultQid(op) && country === placeCountryFor(op, qid)) return { decision: "accept" };
  return { decision: "edit", edited: { wikidata: qid, country } };
}
