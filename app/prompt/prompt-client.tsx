"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useMemo, useState } from "react";

import { generateDeck, type GeneratedSlide } from "../../lib/slide-generator";

const toneOptions = ["Executive", "Educational", "Persuasive", "Creative"];

const starterPrompts = [
  "AI slide deck for a product launch",
  "A workshop on climate tech for students",
  "Investor pitch for a health startup",
];

function slideDeckToMarkdown(slides: GeneratedSlide[]) {
  return slides
    .map((slide) => {
      const bullets = slide.bullets.map((bullet) => `- ${bullet}`).join("\n");

      return [`# ${slide.title}`, slide.subtitle ? `_${slide.subtitle}_` : "", bullets, `Notes: ${slide.speakerNotes}`]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

export default function PromptClient() {
  const router = useRouter();
  const [topic, setTopic] = useState("AI slide deck for a product launch");
  const [slideCount, setSlideCount] = useState(6);
  const [audience, setAudience] = useState("product team");
  const [tone, setTone] = useState("Executive");
  const [slides, setSlides] = useState<GeneratedSlide[]>([]);
  const [isPending, setIsPending] = useState(false);

  async function loadSlides(input: {
    topic: string;
    slideCount: number;
    audience: string;
    tone: string;
  }) {
    setIsPending(true);

    try {
      const response = await generateDeck(input);
      setSlides(response.slides);
      if (response.deckId) {
        router.push(`/presentation/${response.deckId}`);
      }
    } catch (error) {
      console.error(error);
      setSlides([]);
    } finally {
      setIsPending(false);
    }
  }

  const markdownDeck = useMemo(() => slideDeckToMarkdown(slides), [slides]);

  async function handleGenerate() {
    await loadSlides({
      topic,
      slideCount,
      audience,
      tone,
    });
  }

  async function copyDeck() {
    await navigator.clipboard.writeText(markdownDeck);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(252,211,77,0.22),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-950">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="flex items-center justify-between rounded-[32px] border border-white/70 bg-white/75 px-6 py-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">OpenMaic</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">Prompt workspace</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </section>

        <section className="grid gap-6 rounded-[32px] border border-white/70 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              Prompt to slides
            </div>
            <div className="space-y-4">
              <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Generate a slide deck from one prompt.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Start with a topic, choose the audience and tone, then generate an editable deck outline.
                Every successful deck is saved to your dashboard as a downloadable PDF.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Topic</span>
                <textarea
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  rows={4}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]"
                  placeholder="What should the deck be about?"
                />
              </label>

              <div className="space-y-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Audience</span>
                  <input
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]"
                    placeholder="Students, founders, managers..."
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Slides</span>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={slideCount}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSlideCount(nextValue === "" ? 3 : Number(nextValue));
                      }}
                      className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Tone</span>
                    <select
                      value={tone}
                      onChange={(event) => setTone(event.target.value)}
                      className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]"
                    >
                      {toneOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
                disabled={isPending}
              >
                {isPending ? "Generating..." : "Generate and save deck"}
              </button>
              <button
                type="button"
                onClick={copyDeck}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Copy markdown
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {starterPrompts.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => setTopic(starter)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-700"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Deck preview</p>
                <p className="mt-1 text-sm text-slate-300">{slides.length} slides ready</p>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                Gemini-backed
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {slides.slice(0, 4).map((slide) => (
                <article
                  key={`${slide.index}-${slide.title}`}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{slide.kind} slide</p>
                      <h2 className="mt-1 text-lg font-semibold text-white">{slide.title}</h2>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                      {slide.index}
                    </span>
                  </div>
                  {slide.subtitle ? <p className="mt-2 text-sm text-slate-300">{slide.subtitle}</p> : null}
                  <ul className="mt-4 space-y-2 text-sm text-slate-200">
                    {slide.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-cyan-300" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {slides.map((slide) => (
            <article
              key={`${slide.index}-${slide.kind}`}
              className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Slide {slide.index}</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950">{slide.title}</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {slide.kind}
                </span>
              </div>
              {slide.subtitle ? <p className="mt-2 text-sm leading-6 text-slate-600">{slide.subtitle}</p> : null}
              <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                {slide.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-slate-900" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                {slide.speakerNotes}
              </p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
