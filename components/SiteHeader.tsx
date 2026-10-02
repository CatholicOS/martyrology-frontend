import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { getViewer } from "@/lib/viewer";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
        <Link href="/" className="font-serif text-lg font-semibold">
          Martyrology
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {viewer.curator && <Link href="/compare">Compare</Link>}
          {viewer.curator && <Link href="/review">Review</Link>}
          <AuthStatus />
        </nav>
      </div>
    </header>
  );
}
