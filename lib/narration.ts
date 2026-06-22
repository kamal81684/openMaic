export type NarrationSegment = {
  slideIndex: number;
  startTime: number;
  estimatedDuration: number;
  text: string;
};

export type NarrationScript = {
  totalDuration: number;
  script: NarrationSegment[];
};

export type AudioSegmentData = {
  slideIndex: number;
  mimeType: string;
  data: string;
};

export type NarrationState = {
  status: "idle" | "generating" | "ready" | "error";
  script: NarrationScript | null;
  audioSegments: AudioSegmentData[];
  error?: string;
};

export type PlaybackState = {
  isPlaying: boolean;
  currentSegmentIndex: number;
  elapsedTime: number;
  playbackRate: number;
};
