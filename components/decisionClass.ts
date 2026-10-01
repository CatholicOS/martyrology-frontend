import type { DecisionRecord } from "@/lib/changeset";

/** Border/background of a review card by its decision. */
export function decisionClass(decision?: DecisionRecord): string {
  return decision?.decision === "accept"
    ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/30"
    : decision?.decision === "reject"
      ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30"
      : decision?.decision === "edit"
        ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
        : "border-slate-200 dark:border-slate-800";
}
