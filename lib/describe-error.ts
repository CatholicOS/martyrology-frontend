/**
 * A log-safe one-liner for a caught error: its name and message only. Never
 * pass request data (cookies, tokens) to console alongside this.
 */
export function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return typeof err;
}
