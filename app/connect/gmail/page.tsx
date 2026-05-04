import Link from "next/link";

export default function ConnectGmailPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900">Connect Gmail</h1>
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
