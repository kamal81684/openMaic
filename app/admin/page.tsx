import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../lib/auth";
import { isAdminEmail } from "../../lib/admin";
import { loadTtsSettings, toTtsSettingsView, TTS_PROVIDERS } from "../../lib/tts-settings";

import AdminClient from "./admin-client";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/admin");
  }

  if (!isAdminEmail(session.user.email)) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,_#fffaf1_0%,_#f8fafc_100%)] text-slate-950">
        <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
          <section className="w-full rounded-[32px] border border-white/70 bg-white/85 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">OpenMaic</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Admins only</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your account does not have access to the admin panel.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const settings = await loadTtsSettings();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.24),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#fffaf1_0%,_#f8fafc_100%)] text-slate-950">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-4 rounded-[32px] border border-white/70 bg-white/80 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">OpenMaic</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Admin · Voice settings</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Choose which text-to-speech provider powers narration audio.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="self-start rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </section>

        <AdminClient initialSettings={toTtsSettingsView(settings)} providers={TTS_PROVIDERS} />
      </main>
    </div>
  );
}
