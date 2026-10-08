"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import type { CompareDayGroup, CompareRow } from "@/lib/compare";
import EulogyText from "@/components/EulogyText";
import { getElogium, ApiError } from "@/lib/api";
import { apiErrorTitle } from "@/lib/api-error-title";
import type { EulogyOut } from "@/lib/types";

function rowClass(row: CompareRow): string {
  if (row.color === "red") return "bg-red-100 dark:bg-red-950/40";
  if (row.color === "green") return "bg-green-100 dark:bg-green-950/40";
  return "";
}

interface ExpandedState {
  loading: boolean;
  error: string | null;
  data: EulogyOut | null;
}

export default function CompareDay({ group }: { group: CompareDayGroup }) {
  const t = useTranslations("Compare");
  const tErrors = useTranslations("Errors");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, ExpandedState>>({});

  const onRowClick = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (expanded[id]) return;
    setExpanded((prev) => ({ ...prev, [id]: { loading: true, error: null, data: null } }));
    try {
      const data = await getElogium(id);
      setExpanded((prev) => ({ ...prev, [id]: { loading: false, error: null, data } }));
    } catch (err) {
      const message = err instanceof ApiError ? apiErrorTitle(err, tErrors("unreachable")) : t("loadEulogyFailed");
      setExpanded((prev) => ({ ...prev, [id]: { loading: false, error: message, data: null } }));
    }
  };

  return (
    <section className="mb-6" data-testid={`compare-day-${group.day}`}>
      <h3 className="flex items-center gap-3 text-lg font-semibold">
        {group.day}
        <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
          {t.rich("counts", {
            ...group.counts,
            red: (chunks) => <span className="text-red-600 dark:text-red-400">{chunks}</span>,
            green: (chunks) => <span className="text-green-600 dark:text-green-400">{chunks}</span>,
          })}
        </span>
      </h3>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left dark:border-slate-700">
            <th className="py-1 pr-2">{t("columns.id")}</th>
            <th className="py-1 pr-2">{t("columns.subject")}</th>
            <th className="py-1 pr-2">{t("columns.status")}</th>
            <th className="py-1 pr-2">{t("columns.country")}</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <Fragment key={row.id}>
              <tr
                className={`cursor-pointer border-b border-slate-200 dark:border-slate-800 ${rowClass(row)}`}
                onClick={() => onRowClick(row.id)}
              >
                <td className="py-1 pr-2 font-mono text-xs">{row.id}</td>
                <td className="py-1 pr-2">
                  {row.subject}
                  {row.crossDay && (
                    <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                      {t("crossDay", { day: row.anchorDay ?? "" })}
                    </span>
                  )}
                </td>
                <td className="py-1 pr-2">{t(`status.${row.status}`)}</td>
                <td className="py-1 pr-2">{row.country ?? ""}</td>
              </tr>
              {expandedId === row.id && (
                <tr>
                  <td colSpan={4} className="bg-slate-50 p-3 text-sm dark:bg-slate-900">
                    {expanded[row.id]?.loading && <p>{t("loading")}</p>}
                    {expanded[row.id]?.error && (
                      <p className="text-red-600 dark:text-red-400">{expanded[row.id]?.error}</p>
                    )}
                    {expanded[row.id]?.data && (
                      <div>
                        <p className="font-semibold">
                          {expanded[row.id]!.data!.subject.la ?? expanded[row.id]!.data!.id}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          it: {expanded[row.id]!.data!.subject.it ?? "—"} · en:{" "}
                          {expanded[row.id]!.data!.subject.en ?? "—"}
                        </p>
                        {Object.entries(expanded[row.id]!.data!.editions).map(([editionId, placement]) => (
                          <p key={editionId} className="mt-1">
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                              {editionId}:
                            </span>{" "}
                            {placement.text && (
                              <EulogyText text={placement.text} id={expanded[row.id]!.data!.id} edition={editionId} />
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );
}
