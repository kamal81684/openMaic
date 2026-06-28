import Link from "next/link";

import { loadTtsSettings, TTS_PROVIDERS } from "../../lib/tts-settings";
import { getAllDecksForAdmin } from "../../lib/deck-store";
import { getAllUsers } from "../../lib/user-store";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const [settings, decks, users] = await Promise.all([
    loadTtsSettings(),
    getAllDecksForAdmin(),
    getAllUsers(),
  ]);

  const providerLabel =
    TTS_PROVIDERS.find((p) => p.value === settings.provider)?.label ?? settings.provider;
  const withNarration = decks.filter((d) => d.narration).length;
  const adminCount = users.filter((u) => u.isAdmin).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-[28px] border border-white/70 bg-white/80 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Overview</h1>
        <p className="mt-1 text-sm text-slate-600">Manage voice settings, users, and generated decks.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={users.length} sub={`${adminCount} admin${adminCount === 1 ? "" : "s"}`} />
        <StatCard label="Decks" value={decks.length} sub="across all users" />
        <StatCard label="With narration" value={withNarration} sub={`of ${decks.length} decks`} />
        <StatCard label="Voice provider" value={providerLabel} sub="active for narration" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/voice"
          className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl transition hover:border-slate-300"
        >
          <p className="text-sm font-semibold text-slate-900">Voice settings →</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Switch TTS provider and test the connection.
          </p>
        </Link>
        <Link
          href="/admin/users"
          className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl transition hover:border-slate-300"
        >
          <p className="text-sm font-semibold text-slate-900">Manage users →</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Create accounts and remove users.</p>
        </Link>
        <Link
          href="/admin/decks"
          className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl transition hover:border-slate-300"
        >
          <p className="text-sm font-semibold text-slate-900">Browse decks →</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">View slides and narration for every deck.</p>
        </Link>
      </div>
    </div>
  );
}
