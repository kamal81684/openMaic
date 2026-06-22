export async function synthesizeSpeech(text: string): Promise<{ audioContent: string; mimeType: string }> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TTS API key. Set GOOGLE_TTS_API_KEY or GEMINI_API_KEY.");
  }

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: "en-US",
          name: "en-US-Neural2-J",
          ssmlGender: "MALE",
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TTS request failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as { audioContent?: string };

  if (!payload.audioContent) {
    throw new Error("TTS returned empty audio content");
  }

  return { audioContent: payload.audioContent, mimeType: "audio/mpeg" };
}
