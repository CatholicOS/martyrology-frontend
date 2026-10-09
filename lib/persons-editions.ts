import editions from "@/data/persons-editions.json";

/** The editions whose persons crmedr has listed: small, so client components can link to the index of names. */
export const PERSONS_EDITIONS: readonly string[] = editions;

export function hasPersons(edition: string): boolean {
  return PERSONS_EDITIONS.includes(edition);
}
