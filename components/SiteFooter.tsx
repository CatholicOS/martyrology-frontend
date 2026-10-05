import type { DataVersions } from "@/lib/data-versions";

const LINK = "underline hover:text-slate-900 dark:hover:text-slate-100";

/**
 * Copyright notice for the website; the editions' texts carry their own rights (see each book's colophon).
 * `versions` names the API release and the CRMEDR commit being served, when the API could be asked.
 */
export function SiteFooter({ versions = null }: { versions?: DataVersions | null }) {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-5xl space-y-1 p-4 text-center text-xs text-slate-600 dark:text-slate-400">
        <p>
          © {new Date().getFullYear()}{" "}
          <a href="https://catholicdigitalcommons.org" className={LINK}>
            Catholic Digital Commons Foundation
          </a>
          . All rights reserved.
        </p>
        <p>The texts of each edition belong to their rights holders, named on the back of each book.</p>
        {versions && (
          <p>
            <a href={`https://github.com/CatholicOS/martyrology-api/releases/tag/v${versions.api}`} className={LINK}>
              API v{versions.api}
            </a>
            {" · "}
            <a href={`https://github.com/CatholicOS/crmedr/commit/${versions.crmedr}`} className={LINK}>
              CRMEDR {versions.crmedr.slice(0, 7)}
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}
