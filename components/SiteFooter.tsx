/** Copyright notice for the website; the editions' texts carry their own rights (see each book's colophon). */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-5xl space-y-1 p-4 text-center text-xs text-slate-600 dark:text-slate-400">
        <p>
          © {new Date().getFullYear()}{" "}
          <a href="https://catholicdigitalcommons.org" className="underline hover:text-slate-900 dark:hover:text-slate-100">
            Catholic Digital Commons Foundation
          </a>
          . All rights reserved.
        </p>
        <p>The texts of each edition belong to their rights holders, named on the back of each book.</p>
      </div>
    </footer>
  );
}
