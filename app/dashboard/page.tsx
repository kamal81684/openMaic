import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../lib/auth";
import { isAdminEmail } from "../../lib/admin";
import { getDecksCollection, toDeckSummary } from "../../lib/deck-store";

import SignOutButton from "./sign-out-button";

function formatWatchedTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.user.name) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const decksCollection = await getDecksCollection();
  const decks = await decksCollection
    .find({ userEmail: session.user.email })
    .sort({ updatedAt: -1 })
    .limit(24)
    .toArray();

  const deckSummaries = decks.map(toDeckSummary);
  const isAdmin = isAdminEmail(session.user.email);
  const continueDeck = deckSummaries.find((deck) => deck.learningProgress) ?? deckSummaries[0] ?? null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.24),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#fffaf1_0%,_#f8fafc_100%)] text-slate-950">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-4 rounded-[32px] border border-white/70 bg-white/80 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">OpenMaic</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Welcome back, {session.user.name}. Create new slide decks, resume learning, and download any previous PDF.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/prompt"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Generate slide
            </Link>
            {isAdmin ? (
              <Link
                href="/admin"
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Admin
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              Quick action
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Generate a new deck from a prompt</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
              Use the prompt page to describe the deck you want, then come back here to review every saved version and
              download the PDF copy.
            </p>
            <Link
              href="/prompt"
              className="mt-6 inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Open prompt page
            </Link>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Continue learning</p>
                <p className="mt-1 text-sm text-slate-300">Resume where you left off</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">Dashboard</span>
            </div>

            <div className="mt-4">
              {continueDeck ? (
                <article className="rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 via-white/5 to-fuchsia-500/10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Resume Learning</p>
                      <h3 className="mt-2 truncate text-2xl font-semibold text-white">{continueDeck.topic}</h3>
                      <p className="mt-2 text-sm text-slate-300">
                        {continueDeck.audience} · {continueDeck.slideCount} slides
                      </p>
                    </div>
                    <Link
                      href={`/presentation/${continueDeck.id}`}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                    >
                      Continue
                    </Link>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-slate-300">Current progress</span>
                      <span className="font-semibold text-cyan-100">
                        {continueDeck.learningProgress?.completedPercent ?? 0}% Complete
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-white/10">
                      <div
                        className="h-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                        style={{ width: `${continueDeck.learningProgress?.completedPercent ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Current slide</p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {continueDeck.learningProgress ? continueDeck.learningProgress.currentSlideIndex + 1 : 1}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Time watched</p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {formatWatchedTime(continueDeck.learningProgress?.watchedSeconds ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Notes</p>
                      <p className="mt-2 max-h-16 overflow-hidden text-sm text-slate-300">
                        {continueDeck.learningProgress?.notes || "No notes yet"}
                      </p>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  No learning progress yet. Open a deck to start tracking your resume state.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Saved decks</p>
              <p className="mt-1 text-sm text-slate-300">{deckSummaries.length} PDFs available</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">History</span>
          </div>

          <div className="mt-4 space-y-3">
            {deckSummaries.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                No decks yet. Generate your first slide deck to see it here.
              </div>
            ) : (
              deckSummaries.map((deck) => (
                <article key={deck.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{deck.tone}</p>
                      <h3 className="mt-1 text-lg font-semibold text-white">{deck.topic}</h3>
                      <p className="mt-2 text-sm text-slate-300">
                        {deck.audience} · {deck.slideCount} slides · {new Date(deck.createdAt).toLocaleString()}
                      </p>
                      {deck.learningProgress ? (
                        <p className="mt-2 text-xs text-cyan-200">
                          {deck.learningProgress.completedPercent}% complete
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/presentation/${deck.id}`}
                        className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
                      >
                        View
                      </Link>
                      <Link
                        href={`/api/decks/${deck.id}/pdf`}
                        className="rounded-full border border-white/10 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100"
                      >
                        Download PDF
                      </Link>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
