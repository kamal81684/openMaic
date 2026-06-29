import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";

import { authOptions } from "../../../../../lib/auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { getDecksCollection } from "../../../../../lib/deck-store";
import type { QuizQuestion, QuizResponse } from "../../../../../lib/quiz";

function deckQuery(id: string, email: string) {
  return isAdminEmail(email)
    ? { _id: new ObjectId(id) }
    : { _id: new ObjectId(id), userEmail: email };
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

function normalizeQuestion(raw: unknown): QuizQuestion | null {
  if (!raw || typeof raw !== "object") return null;

  const entry = raw as Record<string, unknown>;
  const options = Array.isArray(entry.options)
    ? entry.options
        .filter((option): option is Record<string, unknown> => !!option && typeof option === "object")
        .map((option) => ({
          label: typeof option.label === "string" ? option.label.trim() : "",
          text: typeof option.text === "string" ? option.text.trim() : "",
        }))
        .filter((option) => option.label && option.text)
    : [];

  const question = typeof entry.question === "string" ? entry.question.trim() : "";
  const correctLabel = typeof entry.correctLabel === "string" ? entry.correctLabel.trim() : "";
  const explanation = typeof entry.explanation === "string" ? entry.explanation.trim() : "";

  if (!question || options.length < 2 || !correctLabel || !explanation) {
    return null;
  }

  return {
    question,
    options: options.slice(0, 4),
    correctLabel,
    explanation,
  };
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const slidesSummary = deck.slides
    .map((slide) => `Slide ${slide.index}: ${slide.title}${slide.subtitle ? ` - ${slide.subtitle}` : ""}`)
    .join("\n");

  const prompt = `You are an expert teacher creating a short study quiz.
Create exactly 10 multiple-choice questions about this topic: ${deck.topic}

Use the slides only as helpful context:
${slidesSummary}

Rules:
- Make questions clear and educational.
- Each question must have exactly 4 options.
- Use labels A, B, C, D.
- Include exactly one correct label per question.
- Provide a short explanation for why the answer is correct.
- Return ONLY valid JSON in this schema:
{
  "topic": "",
  "questions": [
    {
      "question": "",
      "options": [
        { "label": "A", "text": "" },
        { "label": "B", "text": "" },
        { "label": "C", "text": "" },
        { "label": "D", "text": "" }
      ],
      "correctLabel": "A",
      "explanation": ""
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
    }
  );

  if (!response.ok) {
    const message = await response.text();
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
  const parsed = extractJson(text) as { topic?: unknown; questions?: unknown };

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions
        .map((question) => normalizeQuestion(question))
        .filter((question): question is QuizQuestion => question !== null)
        .slice(0, 10)
    : [];

  if (questions.length !== 10) {
    return NextResponse.json(
      { error: `Gemini returned ${questions.length} quiz questions instead of 10` },
      { status: 500 }
    );
  }

  const quiz: QuizResponse = {
    topic: typeof parsed.topic === "string" && parsed.topic.trim() ? parsed.topic.trim() : deck.topic,
    questions,
  };

  await decksCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        quiz,
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json(quiz);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    projection: { quiz: 1 },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ quiz: deck.quiz ?? null });
}
