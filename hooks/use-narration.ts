"use client";

import { useCallback, useState } from "react";

import type { NarrationScript, AudioSegmentData } from "../lib/narration";
import { synthesizePuterSegments, type PuterConfig } from "../lib/puter-tts";

type NarrationStatus = "idle" | "generating" | "generating_audio" | "ready" | "error";

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

        // Puter audio isn't stored server-side — synthesize it in the browser.
        if (data.ttsProvider === "puter" && (!data.audioData || data.audioData.length === 0)) {
          setStatus("generating_audio");
          try {
            const segments = await synthesizePuterSegments(
              data.narration.script,
              (data.puterConfig ?? {}) as PuterConfig
            );
            if (segments.length === 0) throw new Error("Puter returned no audio");
            setAudioSegments(segments);
            setStatus("ready");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate Puter audio");
            setStatus("error");
          }
          return true;
        }

        setAudioSegments(data.audioData ?? []);
        setStatus("ready");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [deckId]);

  const generateFullNarration = useCallback(async () => {
    setStatus("generating");
    setError(null);

    try {
      const res = await fetch(`/api/decks/${deckId}/narration`, { method: "POST" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const narrationScript: NarrationScript = await res.json();
      setScript(narrationScript);

      setStatus("generating_audio");

      const audioController = new AbortController();
      const audioTimeout = setTimeout(() => audioController.abort(), 180000);
      let audioRes: Response;
      try {
        audioRes = await fetch(`/api/decks/${deckId}/audio`, {
          method: "POST",
          signal: audioController.signal,
        });
      } finally {
        clearTimeout(audioTimeout);
      }

      if (!audioRes.ok) {
        const data = await audioRes.json().catch(() => ({}));
        throw new Error(data.error || `Audio generation failed (${audioRes.status})`);
      }

      const audioData = await audioRes.json().catch(() => ({}));

      // Puter: the server defers synthesis to the browser.
      if (audioData.clientSide) {
        const segments = await synthesizePuterSegments(
          narrationScript.script,
          (audioData.puterConfig ?? {}) as PuterConfig
        );
        if (segments.length === 0) {
          throw new Error("Puter generated no playable audio");
        }
        setAudioSegments(segments);
        setStatus("ready");
        return;
      }

      let nextAudioSegments: AudioSegmentData[] | null = null;

      if (Array.isArray(audioData.audioData) && audioData.audioData.length > 0) {
        nextAudioSegments = audioData.audioData;
      } else {
        const fetchRes = await fetch(`/api/decks/${deckId}/narration`);
        if (fetchRes.ok) {
          const data = await fetchRes.json();
          if (Array.isArray(data.audioData) && data.audioData.length > 0) {
            nextAudioSegments = data.audioData;
          }
        }
      }

      if (!nextAudioSegments) {
        throw new Error("Audio generation completed, but no playable audio was returned");
      }

      setAudioSegments(nextAudioSegments);
      setStatus("ready");
    } catch (err) {
      const message = err instanceof Error && err.name === "AbortError"
        ? "Audio generation timed out. Try again with fewer slides or shorter narration."
        : err instanceof Error
        ? err.message
        : "Failed to generate narration";
      setError(message);
      setStatus("error");
    }
  }, [deckId]);

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
    generateFullNarration,
    reset,
  };
}
