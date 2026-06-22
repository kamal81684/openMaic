import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";

import { authOptions } from "../../../../../lib/auth";
import { getDecksCollection } from "../../../../../lib/deck-store";
import { synthesizeSpeech } from "../../../../../lib/tts";
import type { NarrationScript, NarrationSegment } from "../../../../../lib/narration";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  for (const segment of narration.script) {
    try {
      const result = await synthesizeSpeech(segment.text);
      audioData.push({
        slideIndex: segment.slideIndex,
        mimeType: result.mimeType,
        data: result.audioContent,
      });
    } catch (error) {
      console.error(`TTS failed for slide ${segment.slideIndex}:`, error);
    }
  }

  if (audioData.length === 0) {
    return NextResponse.json({ error: "All TTS requests failed" }, { status: 500 });
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

  return NextResponse.json({ segments: audioData.length, total: narration.script.length });
}
