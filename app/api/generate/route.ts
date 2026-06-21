import { NextResponse } from "next/server";

import type { GeneratedSlide, SlideKind } from "../../../lib/slide-generator";

const allowedKinds: SlideKind[] = ["cover", "agenda", "content", "takeaway", "closing"];

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asBullets(value: unknown) {
  if (!Array.isArray(value)) {
    return ["", "", "", ""];
  }

  const bullets = value.map((item) => asString(item)).filter(Boolean);

  while (bullets.length < 4) {
    bullets.push("");
  }

  return bullets.slice(0, 4);
}

function normalizeSlide(slide: Partial<GeneratedSlide>, fallbackIndex: number): GeneratedSlide {
  const kind = allowedKinds.includes(slide.kind as SlideKind) ? (slide.kind as SlideKind) : "content";

  return {
    index: Number.isFinite(slide.index) ? Number(slide.index) : fallbackIndex,
    kind,
    title: asString(slide.title, `Slide ${fallbackIndex}`),
    subtitle: typeof slide.subtitle === "string" ? slide.subtitle.trim() : undefined,
    bullets: asBullets(slide.bullets),
    speakerNotes: asString(slide.speakerNotes),
  };
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

export async function POST(req: Request) {
  const { topic, slideCount, audience, tone } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
  }

    console.log("API Key:", apiKey.slice(0, 10));

  const prompt = `You are an expert presentation designer.
Generate exactly ${slideCount} slides.
Topic: ${topic}
Audience: ${audience}
Tone: ${tone}
Return ONLY valid JSON matching this schema:
{
  "slides": [
    {
      "index": 1,
      "kind": "cover",
      "title": "",
      "subtitle": "",
      "bullets": ["", "", "", ""],
      "speakerNotes": ""
    }
  ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
  const message = await response.text();

  console.error("Gemini Error:");
  console.error(message);

  return NextResponse.json(
    {
      error: "Gemini request failed",
      details: message,
    },
    { status: response.status }
  );
}

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = extractJson(text) as { slides?: Array<Partial<GeneratedSlide>> };
  const slides = Array.isArray(parsed.slides)
    ? parsed.slides.map((slide, index) => normalizeSlide(slide, index + 1))
    : [];

  return NextResponse.json({ slides });
}