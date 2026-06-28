"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { synthesizePuterSegments, type PuterConfig } from "../../lib/puter-tts";

type Segment = { slideIndex: number; text: string };

type Props = {
  deckId: string;
  hasNarration: boolean;
  hasAudio: boolean;
  existingSegments: Segment[];
};

export default function DeckGenerate({ deckId, hasNarration, hasAudio, existingSegments }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");

  if (hasNarration && hasAudio) {
    return <span className="text-xs font-medium text-emerald-600">✓ Narration &amp; audio ready</span>;
  }

  const label = hasNarration ? "Generate audio" : "Generate narration & audio";

  async function generate() {
    setBusy(true);
    setError("");
    try {
      // 1. Ensure a narration script exists.
      let segments: Segment[] = existingSegments;
      if (!hasNarration) {
        setStep("Writing narration…");
        const res = await fetch(`/api/decks/${deckId}/narration`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Narration failed (${res.status})`);
        segments = (data.script ?? []).map((s: { slideIndex: number; text: string }) => ({
          slideIndex: s.slideIndex,
          text: s.text,
        }));
      }

      // 2. Generate audio.
      setStep("Generating audio…");
      const audioRes = await fetch(`/api/decks/${deckId}/audio`, { method: "POST" });
      const audioData = await audioRes.json().catch(() => ({}));

      if (audioData.clientSide) {
        // Puter: synthesize in the browser, then persist it on the deck.
        setStep("Synthesizing (Puter)…");
        const synthesized = await synthesizePuterSegments(
          segments,
          (audioData.puterConfig ?? {}) as PuterConfig
        );
        if (synthesized.length === 0) throw new Error("Puter produced no audio");

        const storeRes = await fetch(`/api/admin/decks/${deckId}/audio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioData: synthesized }),
        });
        const storeData = await storeRes.json().catch(() => ({}));
        if (!storeRes.ok) throw new Error(storeData.error || `Storing audio failed (${storeRes.status})`);
      } else if (!audioRes.ok) {
        throw new Error(audioData.error || `Audio failed (${audioRes.status})`);
      }

      setStep("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      {busy && step ? <span className="text-xs text-slate-500">{step}</span> : null}
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Working…" : label}
      </button>
    </div>
  );
}
