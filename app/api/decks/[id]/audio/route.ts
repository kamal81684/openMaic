import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";

import { authOptions } from "../../../../../lib/auth";
import { getDecksCollection } from "../../../../../lib/deck-store";
import { synthesizeSpeech } from "../../../../../lib/tts";
import type { NarrationSegment } from "../../../../../lib/narration";

export const runtime = "nodejs";
export const maxDuration = 300;

const AUDIO_CONCURRENCY = 2;

async function synthesizeSegment(segment: NarrationSegment) {
  const startedAt = Date.now();
  console.log(`TTS start slide ${segment.slideIndex} (${segment.text.length} chars)`);

  const result = await synthesizeSpeech(segment.text);
  console.log(`TTS done slide ${segment.slideIndex} in ${Date.now() - startedAt}ms`);

  return {
    slideIndex: segment.slideIndex,
    mimeType: result.mimeType,
    data: result.audioContent,
  };
}

async function processBatch(
  segments: NarrationSegment[],
  onError: (slideIndex: number, error: string) => void
) {
  const settled = await Promise.allSettled(segments.map((segment) => synthesizeSegment(segment)));
  const audioData: { slideIndex: number; mimeType: string; data: string }[] = [];

  settled.forEach((result, index) => {
    const slideIndex = segments[index]?.slideIndex ?? index;
    if (result.status === "fulfilled") {
      audioData.push(result.value);
      return;
    }

    const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
    console.error(`TTS failed slide ${slideIndex}:`, msg);
    onError(slideIndex, msg);
  });

  return audioData;
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

  const decksCollection = await getDecksCollection();
  const deck = await decksCollection.findOne({ _id: new ObjectId(id), userEmail: session.user.email });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const narration = deck.narration as
    | { totalDuration: number; script: NarrationSegment[]; createdAt: Date }
    | undefined;

  if (!narration || !narration.script || narration.script.length === 0) {
    return NextResponse.json({ error: "No narration script found. Generate narration first." }, { status: 400 });
  }

  const audioData: { slideIndex: number; mimeType: string; data: string }[] = [];
  const errors: { slideIndex: number; error: string }[] = [];

  for (let i = 0; i < narration.script.length; i += AUDIO_CONCURRENCY) {
    const batch = narration.script.slice(i, i + AUDIO_CONCURRENCY);
    const batchAudio = await processBatch(batch, (slideIndex, error) => {
      errors.push({ slideIndex, error });
    });

    for (const item of batchAudio) {
      audioData.push(item);
    }
  }

  if (audioData.length === 0) {
    return NextResponse.json({ error: "All TTS requests failed", details: errors }, { status: 500 });
  }

  await decksCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        audioData,
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({
    segments: audioData.length,
    total: narration.script.length,
    audioData,
    errors: errors.length > 0 ? errors : undefined,
  });
}
