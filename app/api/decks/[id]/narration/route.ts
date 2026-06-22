import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";

import { authOptions } from "../../../../../lib/auth";
import { getDecksCollection } from "../../../../../lib/deck-store";
import type { NarrationScript, NarrationSegment } from "../../../../../lib/narration";

function buildPrompt(topic: string, audience: string, tone: string, slides: { index: number; kind: string; title: string; subtitle?: string; bullets: string[]; speakerNotes: string }[]) {
  const slidesBlock = slides
    .map(
      (s) => `--- Slide ${s.index} (${s.kind}) ---
Title: ${s.title}
${s.subtitle ? `Subtitle: ${s.subtitle}` : ""}
Bullets:
${s.bullets.filter(Boolean).map((b) => `  - ${b}`).join("\n")}
Speaker Notes: ${s.speakerNotes}`
    )
    .join("\n\n");

  return `You are a professional presentation narrator. Generate a conversational, engaging narration script for a slide deck.

Topic: ${topic}
Target Audience: ${audience}
Tone: ${tone}

Here are the slides:

${slidesBlock}

Guidelines:
- Do NOT simply read the slide titles or bullets verbatim.
- Expand every idea with examples, context, and explanations.
- Use smooth transitions between slides.
- Introduce the topic and end with a professional conclusion.
- Sound conversational, engaging, and educational — like a TED speaker.
- Estimate realistic durations (average 20-40 seconds per slide segment, longer for dense slides).
- Each segment's startTime should equal the previous segment's startTime + estimatedDuration.

Return ONLY valid JSON matching this schema:
{
  "totalDuration": number,
  "script": [
    {
      "slideIndex": 1,
      "startTime": 0,
      "estimatedDuration": 30,
      "text": "Your narration text for slide 1..."
    }
  ]
}`;
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

function normalizeNarration(raw: unknown, slideCount: number): NarrationScript {
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
  const deck = await decksCollection.findOne({ _id: new ObjectId(id), userEmail: session.user.email });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const prompt = buildPrompt(deck.topic, deck.audience, deck.tone, deck.slides);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) {
    const message = await response.text();
    console.error("Gemini narration error:", message);
    return NextResponse.json({ error: "Gemini request failed", details: message }, { status: response.status });
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const raw = extractJson(text);
  const narration = normalizeNarration(raw, deck.slides.length);

  if (narration.script.length === 0) {
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

  return NextResponse.json(narration);
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
  const deck = await decksCollection.findOne(
    { _id: new ObjectId(id), userEmail: session.user.email },
    { projection: { narration: 1, audioData: 1 } }
  );

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({
    narration: deck.narration ?? null,
    audioData: deck.audioData ?? [],
  });
}
