import type { AudioSegmentData, NarrationSegment } from "./narration";

export type PuterConfig = { engine?: string; language?: string; voice?: string };

type PuterAudio = { src: string; play: () => void };
type PuterApi = {
  ai: { txt2speech: (text: string, options?: Record<string, unknown>) => Promise<PuterAudio> };
};

const PUTER_SRC = "https://js.puter.com/v2/";
let loadPromise: Promise<PuterApi> | null = null;

/** Inject the Puter.js script once and resolve with the global puter API. */
export function loadPuter(): Promise<PuterApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Puter TTS is only available in the browser."));
  }
  const existingApi = (window as unknown as { puter?: PuterApi }).puter;
  if (existingApi) return Promise.resolve(existingApi);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<PuterApi>((resolve, reject) => {
    const finish = () => {
      const api = (window as unknown as { puter?: PuterApi }).puter;
      if (api) resolve(api);
      else reject(new Error("Puter.js loaded but the API was unavailable."));
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PUTER_SRC}"]`);
    if (existing) {
      if ((window as unknown as { puter?: PuterApi }).puter) return finish();
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () => reject(new Error("Failed to load Puter.js")));
      return;
    }

    const script = document.createElement("script");
    script.src = PUTER_SRC;
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error("Failed to load Puter.js"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

function buildOptions(config: PuterConfig): Record<string, unknown> | undefined {
  const options: Record<string, unknown> = {};
  if (config.engine) options.engine = config.engine;
  if (config.language) options.language = config.language;
  if (config.voice) options.voice = config.voice;
  return Object.keys(options).length > 0 ? options : undefined;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Synthesize one piece of text via Puter and return base64 audio + mime type. */
export async function synthesizePuter(
  text: string,
  config: PuterConfig
): Promise<{ mimeType: string; data: string }> {
  const puter = await loadPuter();
  const audio = await puter.ai.txt2speech(text, buildOptions(config));
  const response = await fetch(audio.src);
  if (!response.ok) throw new Error(`Puter audio fetch failed (${response.status})`);
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("Puter returned empty audio");
  return { mimeType: blob.type || "audio/mpeg", data: await blobToBase64(blob) };
}

/** Synthesize every narration segment via Puter, in order. */
export async function synthesizePuterSegments(
  segments: NarrationSegment[],
  config: PuterConfig
): Promise<AudioSegmentData[]> {
  const out: AudioSegmentData[] = [];
  for (const segment of segments) {
    const { mimeType, data } = await synthesizePuter(segment.text, config);
    out.push({ slideIndex: segment.slideIndex, mimeType, data });
  }
  return out;
}
