import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";

import { authOptions } from "../../../../../lib/auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { getDecksCollection } from "../../../../../lib/deck-store";
import { loadTtsSettings } from "../../../../../lib/tts-settings";
import type { NarrationScript, NarrationSegment } from "../../../../../lib/narration";

/** Admins can act on any deck; regular users only on their own. */
function deckQuery(id: string, email: string) {
  return isAdminEmail(email)
    ? { _id: new ObjectId(id) }
    : { _id: new ObjectId(id), userEmail: email };
}

const GEMINI_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

function buildPrompt(
  topic: string,
  audience: string,
  tone: string,
  slides: { index: number; kind: string; title: string; subtitle?: string; bullets: string[]; speakerNotes: string }[]
) {
  const slidesBlock = slides
    .map(
      (s) => `[Slide ${s.index} - ${s.kind}]
Title: ${s.title}
${s.subtitle ? `Sub: ${s.subtitle}` : ""}${s.bullets.filter(Boolean).map((b) => `\n- ${b}`).join("")}`
    )
    .join("\n\n");

  return `You are a TED-quality narrator. Generate ONE continuous conversational narration for these slides. Do NOT read slides verbatim — explain, connect, and expand each idea naturally.

Topic: ${topic} | Audience: ${audience} | Tone: ${tone}

${slidesBlock}

Rules: Introduce the topic, explain each slide in order with smooth transitions, end with a conclusion. Sound engaging and educational. Estimate realistic timing (20-40s per segment).

Return JSON: { "totalDuration": number, "script": [{ "slideIndex": number, "startTime": number, "estimatedDuration": number, "text": "narration" }] }`;
}

function extractJson(text: string) {
  const trimmed = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Gemini returned non-JSON content");
  }

  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

function normalizeNarration(raw: unknown): NarrationScript {
  const parsed = raw as { totalDuration?: number; script?: unknown[] };

  const totalDuration = typeof parsed.totalDuration === "number" && parsed.totalDuration > 0 ? parsed.totalDuration : 0;

  const script: NarrationSegment[] = Array.isArray(parsed.script)
    ? parsed.script
        .filter((s): s is Record<string, unknown> => s !== null && typeof s === "object")
        .map((s, i) => ({
          slideIndex: typeof s.slideIndex === "number" ? s.slideIndex : i + 1,
          startTime: typeof s.startTime === "number" ? Math.max(0, s.startTime) : 0,
          estimatedDuration: typeof s.estimatedDuration === "number" ? Math.max(5, s.estimatedDuration) : 30,
          text: typeof s.text === "string" ? s.text.trim() : "",
        }))
        .filter((s) => s.text.length > 0)
    : [];

  const computedTotal = script.reduce((sum, s) => sum + s.estimatedDuration, 0);

  return {
    totalDuration: totalDuration > 0 ? totalDuration : computedTotal,
    script,
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
  }

  const decksCollection = await getDecksCollection();
  const deck = await decksCollection.findOne(deckQuery(id, session.user.email));

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const prompt = buildPrompt(deck.topic, deck.audience, deck.tone, deck.slides);

  console.log("Narration prompt length:", prompt.length, "chars for", deck.slides.length, "slides");

  let lastModelError: string | null = null;

  for (const model of GEMINI_MODELS) {
    console.log(`Trying Gemini model: ${model}`);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Retrying ${model} (attempt ${attempt + 1}/${MAX_RETRIES + 1}) in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          const message = await response.text();

          let userMessage = `Gemini API returned status ${response.status}`;
          try {
            const parsed = JSON.parse(message);
            if (parsed.error?.message) {
              userMessage = `Gemini: ${parsed.error.message}`;
            }
          } catch {}

          if (response.status === 503 && attempt < MAX_RETRIES) {
            console.error(`${model} 503, will retry:`, message.slice(0, 300));
            clearTimeout(timeout);
            continue;
          }

          clearTimeout(timeout);
          lastModelError = userMessage;
          console.error(`${model} failed:`, userMessage);
          break;
        }

        const payload = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };

        const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        if (!text) {
          const finishReason = (payload.candidates?.[0] as Record<string, unknown>)?.finishReason;
          clearTimeout(timeout);
          return NextResponse.json(
            { error: `Gemini returned empty response (finishReason: ${finishReason ?? "unknown"})` },
            { status: 500 }
          );
        }

        const raw = extractJson(text);
        const narration = normalizeNarration(raw);

        if (narration.script.length === 0) {
          clearTimeout(timeout);
          return NextResponse.json({ error: "Gemini returned an empty narration script" }, { status: 500 });
        }

        await decksCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              narration: {
                totalDuration: narration.totalDuration,
                script: narration.script,
                createdAt: new Date(),
              },
              updatedAt: new Date(),
            },
          }
        );

        clearTimeout(timeout);
        return NextResponse.json(narration);
      } catch (err) {
        clearTimeout(timeout);

        if (err instanceof Error && err.name === "AbortError") {
          if (attempt < MAX_RETRIES) {
            console.error(`${model} timed out, will retry...`);
            continue;
          }
          lastModelError = `Gemini request timed out after ${GEMINI_TIMEOUT_MS / 1000}s`;
          console.error(`${model} timed out after all retries`);
          break;
        }

        if (attempt < MAX_RETRIES && err instanceof Error && err.message.includes("503")) {
          console.error(`${model} 503, will retry...`);
          continue;
        }

        const msg = err instanceof Error ? err.message : "Unexpected error";
        lastModelError = msg;
        console.error(`${model} unexpected error:`, msg);
        break;
      }
    }
  }

  return NextResponse.json(
    { error: lastModelError || "Gemini API unavailable after all retries. Please try again later." },
    { status: 503 }
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });
  }

  const decksCollection = await getDecksCollection();
  const deck = await decksCollection.findOne(deckQuery(id, session.user.email), {
    projection: { narration: 1, audioData: 1 },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  // Tell the client which TTS provider is active so it can synthesize Puter audio
  // in the browser (Puter has no server-side synthesis).
  const settings = await loadTtsSettings();

  return NextResponse.json({
    narration: deck.narration ?? null,
    audioData: deck.audioData ?? [],
    ttsProvider: settings.provider,
    puterConfig: settings.provider === "puter" ? settings.puter : undefined,
  });
}
