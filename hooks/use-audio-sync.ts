"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { NarrationScript, AudioSegmentData } from "../lib/narration";

type PlaybackState = {
  isPlaying: boolean;
  isPaused: boolean;
  currentSegmentIndex: number;
  elapsedTime: number;
  totalDuration: number;
};

type UseAudioSyncOptions = {
  script: NarrationScript;
  audioSegments: AudioSegmentData[];
  onSlideChange?: (slideIndex: number) => void;
};

export function useAudioSync({ script, audioSegments, onSlideChange }: UseAudioSyncOptions) {
  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentSegmentIndex: 0,
    elapsedTime: 0,
    totalDuration: script.totalDuration,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSegmentRef = useRef(0);
  const blobUrlsRef = useRef<string[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const segmentStartTimeRef = useRef(0);
  const accumulatedTimeRef = useRef(0);

  function createBlobUrls() {
    cleanupBlobUrls();
    const urls = audioSegments.map((seg) => {
      const binary = atob(seg.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: seg.mimeType });
      return URL.createObjectURL(blob);
    });
    blobUrlsRef.current = urls;
    return urls;
  }

  function cleanupBlobUrls() {
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
  }

  function cleanupAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  const startSegment = useCallback(
    (segmentIndex: number, urls: string[]) => {
      cleanupAudio();

      if (segmentIndex >= urls.length) {
        setState((prev) => ({ ...prev, isPlaying: false, isPaused: false }));
        return;
      }

      const audio = new Audio(urls[segmentIndex]);
      audio.playbackRate = 1;
      audioRef.current = audio;
      currentSegmentRef.current = segmentIndex;

      if (segmentIndex > 0) {
        accumulatedTimeRef.current = script.script
          .slice(0, segmentIndex)
          .reduce((sum, s) => sum + s.estimatedDuration, 0);
      } else {
        accumulatedTimeRef.current = 0;
      }

      segmentStartTimeRef.current = 0;

      audio.play().catch(() => {});

      function updateTime() {
        if (audioRef.current) {
          const currentTime = audioRef.current.currentTime;
          const elapsed = accumulatedTimeRef.current + currentTime;
          setState((prev) => ({ ...prev, elapsedTime: elapsed }));
        }
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }

      animationFrameRef.current = requestAnimationFrame(updateTime);

      audio.addEventListener("ended", () => {
        const nextIndex = segmentIndex + 1;
        if (nextIndex < urls.length) {
          startSegment(nextIndex, urls);
        } else {
          cleanupAudio();
          setState((prev) => ({ ...prev, isPlaying: false, isPaused: false }));
        }
      });

      onSlideChange?.(script.script[segmentIndex].slideIndex);
      setState((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        currentSegmentIndex: segmentIndex,
      }));
    },
    [script.script, onSlideChange]
  );

  const play = useCallback(() => {
    if (!audioSegments.length || !script.script.length) return;

    if (state.isPaused && audioRef.current) {
      audioRef.current.play().catch(() => {});
      setState((prev) => ({ ...prev, isPaused: false }));

      function updateTime() {
        if (audioRef.current) {
          const currentTime = audioRef.current.currentTime;
          const elapsed = accumulatedTimeRef.current + currentTime;
          setState((prev) => ({ ...prev, elapsedTime: elapsed }));
        }
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
      animationFrameRef.current = requestAnimationFrame(updateTime);
      return;
    }

    const urls = createBlobUrls();
    startSegment(0, urls);
  }, [audioSegments, script.script, state.isPaused, startSegment]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (state.isPlaying && !state.isPaused) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, state.isPaused, pause, play]);

  const seekToSlide = useCallback(
    (slideIndex: number) => {
      const segIndex = script.script.findIndex((s) => s.slideIndex === slideIndex);
      if (segIndex === -1) return;

      const urls = createBlobUrls();
      startSegment(segIndex, urls);
    },
    [script.script, startSegment]
  );

  const setPlaybackRate = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const stop = useCallback(() => {
    cleanupAudio();
    cleanupBlobUrls();
    accumulatedTimeRef.current = 0;
    setState({
      isPlaying: false,
      isPaused: false,
      currentSegmentIndex: 0,
      elapsedTime: 0,
      totalDuration: script.totalDuration,
    });
  }, [script.totalDuration]);

  useEffect(() => {
    return () => {
      cleanupAudio();
      cleanupBlobUrls();
    };
  }, []);

  return {
    ...state,
    play,
    pause,
    togglePlayPause,
    seekToSlide,
    setPlaybackRate,
    stop,
  };
}
