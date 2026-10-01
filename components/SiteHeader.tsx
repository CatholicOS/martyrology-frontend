import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
        <Link href="/" className="font-semibold">
          Martyrology Curation
        </Link>
        <AuthStatus />
      </div>
    </header>
  );
}
