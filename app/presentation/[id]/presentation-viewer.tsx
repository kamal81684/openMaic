"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { GeneratedSlide } from "../../../lib/slide-generator";
import { useNarration } from "../../../hooks/use-narration";
import NarrationPlayer from "../../../components/narration/narration-player";

type Props = {
  deckId: string;
  topic: string;
  slides: GeneratedSlide[];
};

export default function PresentationViewer({ deckId, topic, slides }: Props) {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const isAutoAdvancing = useRef(false);

  const narration = useNarration(deckId);
  const canGenerateAudio = narration.status === "idle" || (narration.status === "ready" && !narration.hasAudio);

  useEffect(() => {
    narration.checkExisting();
  }, []);

  const goNext = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToSlide = useCallback((index: number) => {
    isAutoAdvancing.current = false;
    setCurrentSlide(index);
  }, []);

  async function handleBack() {
    setIsFinalizing(true);
    try {
      await fetch(`/api/decks/${deckId}/finalize`, { method: "POST" });
    } catch {
    }
    router.push("/dashboard");
  }

  function handleNarrationSlideChange(slideIndex: number) {
    isAutoAdvancing.current = true;
    const idx = slides.findIndex((s) => s.index === slideIndex);
    if (idx !== -1) {
      setCurrentSlide(idx);
    }
  }

  async function handleExplainWithAI() {
    await narration.generateFullNarration();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (narration.status === "ready" && (narration.hasAudio || (narration.script && narration.audioSegments.length > 0))) {
        if (event.key === " ") {
          event.preventDefault();
          return;
        }
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        if (currentSlide < slides.length - 1) {
          goNext();
        }
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        if (currentSlide > 0) {
          goPrev();
        }
      }
      if (event.key === "Escape") {
        handleBack();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide, slides.length, narration.status, narration.hasAudio, narration.audioSegments.length, narration.script, goNext, goPrev]);

  const slide = slides[currentSlide];

  if (!slide) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p>No slides to display.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="flex flex-col border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={isFinalizing}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
            >
              {isFinalizing ? "Saving PDF..." : "Back to Dashboard"}
            </button>
            <span className="text-sm text-slate-500">{topic}</span>
          </div>
          <div className="flex items-center gap-3">
            {canGenerateAudio && (
              <button
                type="button"
                onClick={handleExplainWithAI}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400"
              >
                {narration.status === "ready" ? "Generate Voice" : "Explain with AI"}
              </button>
            )}
            {narration.status === "generating" && (
              <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2">
                <svg className="h-4 w-4 animate-spin text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-amber-300">Generating narration...</span>
              </div>
            )}
            {narration.status === "generating_audio" && (
              <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2">
                <svg className="h-4 w-4 animate-spin text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-amber-300">Generating audio narration...</span>
              </div>
            )}
            {narration.status === "error" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-400">{narration.error || "Generation failed"}</span>
                <button
                  type="button"
                  onClick={handleExplainWithAI}
                  className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
                >
                  Retry
                </button>
              </div>
            )}
            <span className="text-sm text-slate-400">
              {currentSlide + 1} / {slides.length}
            </span>
          </div>
        </div>
        {narration.status === "ready" && narration.script && (
          <div className="px-6 pb-3">
            <NarrationPlayer
              script={narration.script}
              audioSegments={narration.audioSegments}
              currentSlideIndex={currentSlide}
              slides={slides.map((s) => ({ index: s.index }))}
              onSlideChange={handleNarrationSlideChange}
              onReset={narration.reset}
            />
          </div>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center p-8">
        <div className="flex w-full max-w-5xl items-center gap-6">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentSlide === 0}
            className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-white/20 text-white transition hover:bg-white/10 disabled:opacity-30"
            aria-label="Previous slide"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>

          <div className="flex-1 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 p-12 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-wider text-slate-400">
                {slide.kind}
              </span>
              <span className="text-xs text-slate-500">Slide {slide.index}</span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-white">{slide.title}</h1>

            {slide.subtitle ? (
              <p className="mt-4 text-xl text-slate-300">{slide.subtitle}</p>
            ) : null}

            <ul className="mt-8 space-y-4">
              {slide.bullets.filter(Boolean).map((bullet) => (
                <li key={bullet} className="flex gap-3 text-lg text-slate-200">
                  <span className="mt-2 h-2 w-2 flex-none rounded-full bg-cyan-400" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            {slide.speakerNotes ? (
              <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Speaker Notes</p>
                <p className="mt-2 text-sm text-slate-400">{slide.speakerNotes}</p>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={currentSlide === slides.length - 1}
            className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-white/20 text-white transition hover:bg-white/10 disabled:opacity-30"
            aria-label="Next slide"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-3">
        <div className="flex items-center justify-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition ${
                index === currentSlide
                  ? "w-8 bg-cyan-400"
                  : "w-2 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </footer>
    </div>
  );
}
