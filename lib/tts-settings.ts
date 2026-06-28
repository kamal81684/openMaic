import { mongoClientPromise } from "./mongodb";

export type TtsProvider = "vibevoice" | "elevenlabs" | "sarvam" | "google";

export const TTS_PROVIDERS: { value: TtsProvider; label: string; description: string }[] = [
  {
    value: "vibevoice",
    label: "VibeVoice (self-hosted)",
    description: "Open-source TTS running on your own inference server.",
  },
  {
    value: "elevenlabs",
    label: "ElevenLabs",
    description: "Hosted, high-quality cloud voices.",
  },
  {
    value: "sarvam",
    label: "Sarvam AI",
    description: "Indian-language focused hosted TTS.",
  },
  {
    value: "google",
    label: "Google Cloud TTS",
    description: "Google Cloud Text-to-Speech voices.",
  },
];

export type TtsSettings = {
  provider: TtsProvider;
  vibevoice: { serverUrl: string };
  elevenlabs: { apiKey: string; voiceId: string; modelId: string };
  sarvam: { apiKey: string; speaker: string; targetLanguageCode: string; model: string };
  google: { apiKey: string; voiceName: string; languageCode: string };
};

/** Settings safe to send to the browser — secrets are replaced with a boolean flag. */
export type TtsSettingsView = {
  provider: TtsProvider;
  vibevoice: { serverUrl: string };
  elevenlabs: { apiKeySet: boolean; voiceId: string; modelId: string };
  sarvam: { apiKeySet: boolean; speaker: string; targetLanguageCode: string; model: string };
  google: { apiKeySet: boolean; voiceName: string; languageCode: string };
};

const SETTINGS_ID = "tts";
const COLLECTION = "appSettings";

export function defaultTtsSettings(): TtsSettings {
  return {
    provider: "vibevoice",
    vibevoice: { serverUrl: process.env.VIBEVOICE_SERVER_URL || "" },
    elevenlabs: { apiKey: "", voiceId: "21m00Tcm4TlvDq8ikWAM", modelId: "eleven_multilingual_v2" },
    sarvam: { apiKey: "", speaker: "anushka", targetLanguageCode: "en-IN", model: "bulbul:v2" },
    google: { apiKey: "", voiceName: "en-US-Neural2-C", languageCode: "en-US" },
  };
}

async function getSettingsCollection() {
  const client = await mongoClientPromise;
  return client.db().collection(COLLECTION);
}

export async function loadTtsSettings(): Promise<TtsSettings> {
  const defaults = defaultTtsSettings();
  const col = await getSettingsCollection();
  const doc = (await col.findOne({ _id: SETTINGS_ID as unknown as never })) as
    | (Partial<TtsSettings> & Record<string, unknown>)
    | null;

  if (!doc) return defaults;

  return {
    provider: (doc.provider as TtsProvider) ?? defaults.provider,
    vibevoice: { ...defaults.vibevoice, ...(doc.vibevoice ?? {}) },
    elevenlabs: { ...defaults.elevenlabs, ...(doc.elevenlabs ?? {}) },
    sarvam: { ...defaults.sarvam, ...(doc.sarvam ?? {}) },
    google: { ...defaults.google, ...(doc.google ?? {}) },
  };
}

export async function saveTtsSettings(settings: TtsSettings): Promise<void> {
  const col = await getSettingsCollection();
  await col.updateOne(
    { _id: SETTINGS_ID as unknown as never },
    { $set: { ...settings, updatedAt: new Date() } },
    { upsert: true }
  );
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

const VALID_PROVIDERS = new Set(TTS_PROVIDERS.map((p) => p.value));

export function isValidProvider(value: unknown): value is TtsProvider {
  return typeof value === "string" && VALID_PROVIDERS.has(value as TtsProvider);
}

/**
 * Merge an incoming (untrusted) settings body over the current settings.
 * Blank API-key fields mean "keep the stored key" so secrets never need re-entering.
 */
export function mergeTtsSettings(current: TtsSettings, body: Record<string, unknown>): TtsSettings {
  const provider = isValidProvider(body.provider) ? body.provider : current.provider;
  const vibevoice = (body.vibevoice ?? {}) as Record<string, unknown>;
  const elevenlabs = (body.elevenlabs ?? {}) as Record<string, unknown>;
  const sarvam = (body.sarvam ?? {}) as Record<string, unknown>;
  const google = (body.google ?? {}) as Record<string, unknown>;

  const keepKey = (incoming: unknown, existing: string) => {
    const next = str(incoming).trim();
    return next.length > 0 ? next : existing;
  };

  return {
    provider,
    vibevoice: {
      serverUrl: str(vibevoice.serverUrl, current.vibevoice.serverUrl).trim(),
    },
    elevenlabs: {
      apiKey: keepKey(elevenlabs.apiKey, current.elevenlabs.apiKey),
      voiceId: str(elevenlabs.voiceId, current.elevenlabs.voiceId).trim(),
      modelId: str(elevenlabs.modelId, current.elevenlabs.modelId).trim(),
    },
    sarvam: {
      apiKey: keepKey(sarvam.apiKey, current.sarvam.apiKey),
      speaker: str(sarvam.speaker, current.sarvam.speaker).trim(),
      targetLanguageCode: str(sarvam.targetLanguageCode, current.sarvam.targetLanguageCode).trim(),
      model: str(sarvam.model, current.sarvam.model).trim(),
    },
    google: {
      apiKey: keepKey(google.apiKey, current.google.apiKey),
      voiceName: str(google.voiceName, current.google.voiceName).trim(),
      languageCode: str(google.languageCode, current.google.languageCode).trim(),
    },
  };
}

export function toTtsSettingsView(settings: TtsSettings): TtsSettingsView {
  return {
    provider: settings.provider,
    vibevoice: { serverUrl: settings.vibevoice.serverUrl },
    elevenlabs: {
      apiKeySet: Boolean(settings.elevenlabs.apiKey),
      voiceId: settings.elevenlabs.voiceId,
      modelId: settings.elevenlabs.modelId,
    },
    sarvam: {
      apiKeySet: Boolean(settings.sarvam.apiKey),
      speaker: settings.sarvam.speaker,
      targetLanguageCode: settings.sarvam.targetLanguageCode,
      model: settings.sarvam.model,
    },
    google: {
      apiKeySet: Boolean(settings.google.apiKey),
      voiceName: settings.google.voiceName,
      languageCode: settings.google.languageCode,
    },
  };
}
