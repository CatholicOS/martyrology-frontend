import { Link } from "@/i18n/navigation";
import { AuthStatus } from "@/components/AuthStatus";
import { LocalePicker } from "@/components/LocalePicker";
import { NavMenu } from "@/components/NavMenu";
import { getViewer } from "@/lib/viewer";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
        <Link href="/" className="font-serif text-lg font-semibold">
          Martyrology
        </Link>
        <NavMenu>
          <Link href="/docs/en">Docs</Link>
          <Link href="/map">Map</Link>
          <Link href="/scalar">API</Link>
          {viewer.curator && <Link href="/compare">Compare</Link>}
          {viewer.curator && <Link href="/review">Review</Link>}
          <LocalePicker />
          <AuthStatus />
        </NavMenu>
      </div>
    </header>
  );
}
