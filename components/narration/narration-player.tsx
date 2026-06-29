"use client";

import { useEffect, useMemo, useState } from "react";

import type { NarrationScript, AudioSegmentData } from "../../lib/narration";
import { useAudioSync } from "../../hooks/use-audio-sync";

type Props = {
  script: NarrationScript;
  audioSegments: AudioSegmentData[];
  currentSlideIndex: number;
  slides: { index: number }[];
  onSlideChange: (slideIndex: number) => void;
  onReset: () => void;
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function NarrationPlayer({ script, audioSegments, currentSlideIndex: _currentSlideIndex, slides, onSlideChange, onReset }: Props) {
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const sync = useAudioSync({
    script,
    audioSegments,
    onSlideChange,
  });
  const { setPlaybackRate } = sync;
  void _currentSlideIndex;

  const audioReady = audioSegments.length > 0;

  useEffect(() => {
    setPlaybackRate(speed);
  }, [speed, setPlaybackRate]);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const progress = sync.totalDuration > 0 ? (sync.elapsedTime / sync.totalDuration) * 100 : 0;

  const segmentMarkers = useMemo(() => {
    if (!script.script.length || sync.totalDuration === 0) return [];
    return script.script.map((seg) => ({
      slideIndex: seg.slideIndex,
      position: (seg.startTime / sync.totalDuration) * 100,
      isActive: seg.slideIndex === script.script[sync.currentSegmentIndex]?.slideIndex,
    }));
  }, [script.script, sync.totalDuration, sync.currentSegmentIndex]);

  function handleProgressBarClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const targetTime = ratio * sync.totalDuration;
    const segment = [...script.script].reverse().find((s) => s.startTime <= targetTime);
    if (segment) {
      sync.seekToSlide(segment.slideIndex);
    }
  }

  if (!audioReady) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3">
        <svg className="h-5 w-5 animate-spin text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm text-amber-300">Generating audio narration...</span>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={sync.togglePlayPause}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500 text-slate-900 transition hover:bg-cyan-400"
            aria-label={sync.isPlaying && !sync.isPaused ? "Pause" : "Play"}
          >
            {sync.isPlaying && !sync.isPaused ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            )}
          </button>

          <div className="flex items-center gap-2 text-sm tabular-nums">
            <span className="text-slate-300">{formatTime(sync.elapsedTime)}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-500">{formatTime(sync.totalDuration)}</span>
          </div>
        </div>

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={sync.stop}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/10"
          >
            Stop
          </button>

          <button
            type="button"
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="relative rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
          >
            {speed}x
          </button>

          {showSpeedMenu && (
            <div className="absolute right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-xl">
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { setSpeed(opt); setShowSpeedMenu(false); }}
                  className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-white/10 ${
                    speed === opt ? "text-cyan-400" : "text-slate-300"
                  }`}
                >
                  {opt}x
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/10"
          >
            Reset
          </button>
        </div>
      </div>

      <div
        className="relative mt-3 h-1.5 cursor-pointer rounded-full bg-white/10"
        onClick={handleProgressBarClick}
      >
        {segmentMarkers.map((marker) => (
          <div
            key={marker.slideIndex}
            className={`absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full transition-colors ${
              marker.isActive ? "bg-cyan-400" : "bg-white/30"
            }`}
            style={{ left: `${marker.position}%` }}
          />
        ))}
        <div
          className="h-full rounded-full bg-cyan-500 transition-all duration-200"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {slides.map((slide) => {
            const seg = script.script.find((s) => s.slideIndex === slide.index);
            const isActive = seg?.slideIndex === script.script[sync.currentSegmentIndex]?.slideIndex;
            const isPast = seg
              ? seg.startTime + seg.estimatedDuration <= sync.elapsedTime
              : false;
            return (
              <button
                key={slide.index}
                type="button"
                onClick={() => sync.seekToSlide(slide.index)}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium transition ${
                  isActive
                    ? "bg-cyan-500 text-slate-900"
                    : isPast
                    ? "bg-white/20 text-slate-400"
                    : "bg-white/10 text-slate-500 hover:bg-white/20"
                }`}
                title={`Jump to slide ${slide.index}`}
              >
                {slide.index}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-500">
          {script.script.length} segments
        </div>
      </div>
    </div>
  );
}
