// Presentational only. The sign-in and sign-out controls are passed in as
// elements so this component has no dependency on Auth.js and can be
// rendered in a plain jsdom test.
export function AuthStatusView({
  email,
  error,
  onSignIn,
  onSignOut,
}: {
  email: string | null | undefined;
  error?: string;
  onSignIn: React.ReactNode;
  onSignOut: React.ReactNode;
}) {
  if (!email) return <div className="flex flex-wrap items-center gap-3">{onSignIn}</div>;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {error ? (
        <span role="status" className="text-sm text-amber-700 dark:text-amber-400">
          Session expired — sign in again
        </span>
      ) : null}
      {/* An icon, not the address: the full email took too much of the header. The address
          stays available as a tooltip and to screen readers. */}
      <span title={email} className="inline-flex text-slate-600 dark:text-slate-400">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
        <span className="sr-only">Signed in as {email}</span>
      </span>
      {/* The message asks the curator to sign in again, so offer the control. */}
      {error ? onSignIn : null}
      {onSignOut}
    </div>
  );
}
