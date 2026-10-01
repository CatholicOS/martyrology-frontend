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
  if (!email) return <div className="flex items-center gap-3">{onSignIn}</div>;

  return (
    <div className="flex items-center gap-3">
      {error ? (
        <span role="status" className="text-sm text-amber-700 dark:text-amber-400">
          Session expired — sign in again
        </span>
      ) : null}
      <span className="text-sm text-slate-600 dark:text-slate-400">{email}</span>
      {onSignOut}
    </div>
  );
}
