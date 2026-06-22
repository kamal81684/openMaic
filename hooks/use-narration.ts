"use client";

import { useCallback, useState } from "react";

import type { NarrationScript, AudioSegmentData } from "../lib/narration";

type NarrationStatus = "idle" | "generating" | "ready" | "error";

export function useNarration(deckId: string) {
  const [status, setStatus] = useState<NarrationStatus>("idle");
  const [script, setScript] = useState<NarrationScript | null>(null);
  const [audioSegments, setAudioSegments] = useState<AudioSegmentData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const checkExisting = useCallback(async () => {
    try {
      const res = await fetch(`/api/decks/${deckId}/narration`);
      if (!res.ok) return false;

      const data = await res.json();
      if (data.narration?.script?.length > 0) {
        setScript(data.narration);
        setAudioSegments(data.audioData ?? []);
        setStatus("ready");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [deckId]);

  const generateNarration = useCallback(async () => {
    setStatus("generating");
    setError(null);

    try {
      const res = await fetch(`/api/decks/${deckId}/narration`, { method: "POST" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data: NarrationScript = await res.json();
      setScript(data);
      setStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate narration";
      setError(message);
      setStatus("error");
    }
  }, [deckId]);

  const generateAudio = useCallback(async () => {
    if (!script) return;

    try {
      const res = await fetch(`/api/decks/${deckId}/audio`, { method: "POST" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Audio generation failed (${res.status})`);
      }

      await res.json();

      const fetchRes = await fetch(`/api/decks/${deckId}/narration`);
      if (fetchRes.ok) {
        const data = await fetchRes.json();
        if (data.audioData) {
          setAudioSegments(data.audioData);
        }
      }
    } catch (err) {
      console.error("Audio generation error:", err);
    }
  }, [deckId, script]);

  const reset = useCallback(() => {
    setStatus("idle");
    setScript(null);
    setAudioSegments([]);
    setError(null);
  }, []);

  return {
    status,
    script,
    audioSegments,
    error,
    hasAudio: audioSegments.length > 0,
    checkExisting,
    generateNarration,
    generateAudio,
    reset,
  };
}
