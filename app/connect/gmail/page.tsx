import Link from "next/link";

const errorMessages: Record<string, string> = {
  state: "The sign-in session expired or was invalid. Try connecting again.",
  missing_env: "Gmail OAuth is not configured on the server (missing client ID or secret).",
  token_exchange:
    "Google sign-in worked, but saving the connection failed. On Vercel this is usually fixed by the latest deploy. If it persists, check Vercel logs for [gmail/callback]."
};

export default async function ConnectGmailPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorText = error ? errorMessages[error] ?? `Something went wrong (${error}).` : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center bg-surface px-4 py-10">
      <section className="w-full rounded-xl border border-slate-200/60 bg-white p-6 shadow-soft sm:p-8">
        <h1 className="font-display text-2xl font-bold text-brand">Connect Gmail</h1>
        {errorText ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            {errorText}
          </div>
        ) : null}
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Connect your Google account so TownReach can send outreach and sync replies from Gmail.
        </p>
        <ol className="mt-5 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Review the Google permissions screen.</li>
          <li>Approve access for this app.</li>
          <li>You will return to TownReach and Gmail will be marked connected.</li>
        </ol>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/api/auth/gmail/start"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-container"
          >
            Continue to Google
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </section>
    </main>
  );
}

