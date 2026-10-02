/** Zitadel's project-roles claim, which it sends without an :aud scope (the app lives in the project). */
export const ROLES_CLAIM = "urn:zitadel:iam:org:project:roles";

const CURATION_ROLES = ["admin", "martyrology_editor"];

/**
 * The claim is an object keyed by role name: {"admin": {"<orgId>": "<domain>"}}.
 * Anything else, including a missing claim, means "not a curator".
 */
export function isCurator(rolesClaim: unknown): boolean {
  if (typeof rolesClaim !== "object" || rolesClaim === null || Array.isArray(rolesClaim)) return false;
  return CURATION_ROLES.some((role) => Object.prototype.hasOwnProperty.call(rolesClaim, role));
}
