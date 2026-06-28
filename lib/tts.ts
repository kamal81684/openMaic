import { loadTtsSettings, type TtsSettings } from "./tts-settings";

const TTS_TIMEOUT_MS = 60000;
const CACHE_MAX_SIZE = 50;

export type SynthesisResult = { audioContent: string; mimeType: string };

// Cache keyed by provider + voice config + text, so switching provider/voice
// never returns stale audio from a previous configuration.
const responseCache = new Map<string, SynthesisResult>();

function cacheGet(key: string): SynthesisResult | undefined {
  return responseCache.get(key);
}

function cacheSet(key: string, value: SynthesisResult) {
  if (responseCache.size >= CACHE_MAX_SIZE) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }
  responseCache.set(key, value);
}

async function fetchWithTimeout(url: string, init: RequestInit, label: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`${label} request timed out after ${TTS_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// VibeVoice (self-hosted)
// ---------------------------------------------------------------------------
const VIBEVOICE_ENDPOINTS = ["/v1/tts", "/synthesize", "/"];

async function synthesizeVibeVoice(text: string, cfg: TtsSettings["vibevoice"]): Promise<SynthesisResult> {
  const raw = cfg.serverUrl?.trim();
  if (!raw) {
    throw new Error(
      "VibeVoice server URL is not configured. Set it in the admin panel (or VIBEVOICE_SERVER_URL)."
    );
  }
  const baseUrl = raw.replace(/\/+$/, "");
  let lastError: Error | null = null;

  for (const endpoint of VIBEVOICE_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
        "VibeVoice"
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        lastError = new Error(`VibeVoice error (${response.status}): ${body.slice(0, 300)}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 44) {
        lastError = new Error("VibeVoice returned audio too small to be valid");
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const mimeType = contentType.includes("mpeg") ? "audio/mpeg" : "audio/wav";
      return { audioContent: buffer.toString("base64"), mimeType };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("VibeVoice server unreachable. Check the server URL.");
}

// ---------------------------------------------------------------------------
// ElevenLabs
// ---------------------------------------------------------------------------
async function synthesizeElevenLabs(text: string, cfg: TtsSettings["elevenlabs"]): Promise<SynthesisResult> {
  if (!cfg.apiKey) throw new Error("ElevenLabs API key is not configured.");
  const voiceId = cfg.voiceId?.trim() || "21m00Tcm4TlvDq8ikWAM";

  const response = await fetchWithTimeout(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": cfg.apiKey,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: cfg.modelId?.trim() || "eleven_multilingual_v2",
      }),
    },
    "ElevenLabs"
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ElevenLabs error (${response.status}): ${body.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error("ElevenLabs returned empty audio");
  return { audioContent: buffer.toString("base64"), mimeType: "audio/mpeg" };
}

// ---------------------------------------------------------------------------
// Sarvam AI
// ---------------------------------------------------------------------------
async function synthesizeSarvam(text: string, cfg: TtsSettings["sarvam"]): Promise<SynthesisResult> {
  if (!cfg.apiKey) throw new Error("Sarvam AI API key is not configured.");

  const response = await fetchWithTimeout(
    "https://api.sarvam.ai/text-to-speech",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": cfg.apiKey,
      },
      body: JSON.stringify({
        text,
        target_language_code: cfg.targetLanguageCode?.trim() || "en-IN",
        speaker: cfg.speaker?.trim() || "anushka",
        model: cfg.model?.trim() || "bulbul:v2",
      }),
    },
    "Sarvam"
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Sarvam error (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { audios?: string[] };
  const audioContent = payload.audios?.[0];
  if (!audioContent) throw new Error("Sarvam returned no audio");
  // Sarvam returns base64-encoded WAV.
  return { audioContent, mimeType: "audio/wav" };
}

// ---------------------------------------------------------------------------
// Google Cloud Text-to-Speech
// ---------------------------------------------------------------------------
async function synthesizeGoogle(text: string, cfg: TtsSettings["google"]): Promise<SynthesisResult> {
  if (!cfg.apiKey) throw new Error("Google Cloud TTS API key is not configured.");

  const response = await fetchWithTimeout(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(cfg.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: cfg.languageCode?.trim() || "en-US",
          name: cfg.voiceName?.trim() || undefined,
        },
        audioConfig: { audioEncoding: "MP3" },
      }),
    },
    "Google TTS"
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google TTS error (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { audioContent?: string };
  if (!payload.audioContent) throw new Error("Google TTS returned no audio");
  return { audioContent: payload.audioContent, mimeType: "audio/mpeg" };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------
function cacheKeyFor(settings: TtsSettings, text: string): string {
  const { provider } = settings;
  switch (provider) {
    case "vibevoice":
      return `vibevoice|${settings.vibevoice.serverUrl}|${text}`;
    case "elevenlabs":
      return `elevenlabs|${settings.elevenlabs.voiceId}|${settings.elevenlabs.modelId}|${text}`;
    case "sarvam":
      return `sarvam|${settings.sarvam.speaker}|${settings.sarvam.targetLanguageCode}|${settings.sarvam.model}|${text}`;
    case "google":
      return `google|${settings.google.voiceName}|${settings.google.languageCode}|${text}`;
    default:
      return `${provider}|${text}`;
  }
}

// Dispatch to the active provider using explicit settings (no caching).
// Used by both synthesizeSpeech and the admin "test connection" endpoint.
export async function synthesizeWithSettings(settings: TtsSettings, text: string): Promise<SynthesisResult> {
  switch (settings.provider) {
    case "puter":
      // Puter TTS runs in the browser (no API key); it can't be synthesized server-side.
      throw new Error("Puter TTS is generated in the browser and has no server-side synthesis.");
    case "elevenlabs":
      return synthesizeElevenLabs(text, settings.elevenlabs);
    case "sarvam":
      return synthesizeSarvam(text, settings.sarvam);
    case "google":
      return synthesizeGoogle(text, settings.google);
    case "vibevoice":
    default:
      return synthesizeVibeVoice(text, settings.vibevoice);
  }
}

export async function synthesizeSpeech(text: string): Promise<SynthesisResult> {
  const settings = await loadTtsSettings();
  const key = cacheKeyFor(settings, text);

  const cached = cacheGet(key);
  if (cached) return cached;

  const result = await synthesizeWithSettings(settings, text);
  cacheSet(key, result);
  return result;
}
