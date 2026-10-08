import { useTranslations } from "next-intl";
import { splitUrl } from "@/lib/text-url";

/** Why a copyrighted edition will not open, and what the reader can do about it. */
export default function LockedNotice({
  title,
  signedIn,
  accessInfo,
  onSignIn,
  onClose,
}: {
  title: string;
  signedIn: boolean;
  accessInfo?: string | null;
  onSignIn: () => void;
  onClose?: () => void;
}) {
  const t = useTranslations("Auth");
  return (
    <div role="status" className="mx-auto mt-6 max-w-xl rounded border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/40">
      <p className="font-semibold">{t("lockedTitle", { title })}</p>
      {signedIn ? (
        <p className="mt-1">
          {t("lockedNoAccess")}
          {accessInfo && (
            <span className="mt-1 block text-slate-600 dark:text-slate-400">
              {splitUrl(accessInfo).map((p, i) =>
                p.href ? (
                  <a key={i} href={p.href} className="underline">{p.text}</a>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </span>
          )}
        </p>
      ) : (
        <p className="mt-1 flex items-center gap-3">
          {t("lockedSignInPrompt")}
          <button type="button" className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700" onClick={onSignIn}>
            {t("signIn")}
          </button>
        </p>
      )}
      {onClose && (
        <button type="button" className="mt-2 text-xs underline" onClick={onClose}>
          {t("close")}
        </button>
      )}
    </div>
  );
}
