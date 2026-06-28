import Link from "next/link";

import type { AdminDeckSummary } from "../../lib/deck-store";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const KIND_BADGE: Record<string, string> = {
  cover: "bg-amber-100 text-amber-700",
  agenda: "bg-sky-100 text-sky-700",
  content: "bg-slate-100 text-slate-600",
  takeaway: "bg-emerald-100 text-emerald-700",
  closing: "bg-violet-100 text-violet-700",
};

export default function DecksPanel({ decks }: { decks: AdminDeckSummary[] }) {
  return (
    <section className="flex flex-col gap-4 rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">All generated decks</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every deck across all users, with its narration when available.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          {decks.length} {decks.length === 1 ? "deck" : "decks"}
        </span>
      </div>

      {decks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-500">
          No decks have been generated yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {decks.map((deck) => (
            <details
              key={deck.id}
              className="group rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 transition open:shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
            >
              <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{deck.topic}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {deck.userName || deck.userEmail} · {formatDate(deck.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                    {deck.slides.length} slides
                  </span>
                  {deck.narration ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                      Narration · {formatDuration(deck.narration.totalDuration)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-400">No narration</span>
                  )}
                  {deck.audioCount > 0 ? (
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">
                      Audio · {deck.audioCount}
                    </span>
                  ) : null}
                  <span className="text-slate-400 transition group-open:rotate-180">▾</span>
                </div>
              </summary>

              <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Slides</h3>
                  <ol className="mt-2 space-y-2">
                    {deck.slides.map((slide) => (
                      <li key={slide.index} className="rounded-2xl border border-slate-100 bg-white px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              KIND_BADGE[slide.kind] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {slide.kind}
                          </span>
                          <span className="truncate text-sm font-medium text-slate-800">
                            {slide.index}. {slide.title}
                          </span>
                        </div>
                        {slide.subtitle ? <p className="mt-1 text-xs text-slate-500">{slide.subtitle}</p> : null}
                        {slide.bullets.length > 0 ? (
                          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-slate-500">
                            {slide.bullets.filter(Boolean).map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Narration</h3>
                  {deck.narration ? (
                    <ol className="mt-2 space-y-2">
                      {deck.narration.segments.map((seg, i) => (
                        <li key={i} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                          <p className="text-[11px] font-semibold text-emerald-700">
                            Slide {seg.slideIndex} · ~{formatDuration(seg.estimatedDuration)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">{seg.text}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                      No narration generated for this deck yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Link
                  href={`/presentation/${deck.id}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Open presentation →
                </Link>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
