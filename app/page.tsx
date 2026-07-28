import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Martyrology Curation</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Review draft canonical IDs across editions of the Roman Martyrology.
      </p>
      <nav className="mt-6 flex gap-4">
        <Link href="/compare" className="rounded bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900">
          Compare editions
        </Link>
        <Link href="/review" className="rounded border border-slate-300 px-4 py-2 dark:border-slate-700">
          Review change-set
        </Link>
      </nav>
    </main>
  );
}
