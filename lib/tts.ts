const TTS_TIMEOUT_MS = 60000;
const CACHE_MAX_SIZE = 50;

const responseCache = new Map<string, { audioContent: string; mimeType: string }>();

function getServerUrl(): string {
  const url = process.env.VIBEVOICE_SERVER_URL;
  if (!url) {
    throw new Error(
      "Missing VIBEVOICE_SERVER_URL environment variable. Set it to your VibeVoice inference server address (e.g. http://localhost:8080)."
    );
  }
  return url.replace(/\/+$/, "");
}

const ENDPOINTS = ["/v1/tts", "/synthesize", "/"];

export async function synthesizeSpeech(text: string): Promise<{ audioContent: string; mimeType: string }> {
  const cacheKey = text;

  const cached = responseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const baseUrl = getServerUrl();
  let lastError: Error | null = null;

  for (const endpoint of ENDPOINTS) {
    const url = `${baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        lastError = new Error(`VibeVoice error (${response.status}): ${body.slice(0, 300)}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) {
        lastError = new Error("VibeVoice returned empty audio");
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const mimeType = contentType.includes("mpeg") ? "audio/mpeg" : "audio/wav";

      if (buffer.length < 44) {
        lastError = new Error("VibeVoice returned audio too small to be valid");
        continue;
      }

      const audioContent = buffer.toString("base64");

      if (responseCache.size >= CACHE_MAX_SIZE) {
        const firstKey = responseCache.keys().next().value;
        if (firstKey) responseCache.delete(firstKey);
      }
      responseCache.set(cacheKey, { audioContent, mimeType });

      return { audioContent, mimeType };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        lastError = new Error(`VibeVoice request timed out after ${TTS_TIMEOUT_MS / 1000}s`);
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("VibeVoice server unreachable. Check VIBEVOICE_SERVER_URL.");
}
