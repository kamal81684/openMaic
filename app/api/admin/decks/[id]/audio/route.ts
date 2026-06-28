import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAdminApi } from "../../../../../../lib/require-admin";
import { getDecksCollection } from "../../../../../../lib/deck-store";

export const runtime = "nodejs";

type IncomingSegment = { slideIndex: number; mimeType: string; data: string };

function isValidSegment(value: unknown): value is IncomingSegment {
  if (!value || typeof value !== "object") return false;
  const seg = value as Record<string, unknown>;
  return (
    typeof seg.slideIndex === "number" &&
    typeof seg.mimeType === "string" &&
    typeof seg.data === "string" &&
    seg.data.length > 0
  );
}

/** Store browser-generated (e.g. Puter) audio for any deck. Admin-only. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = Array.isArray(body.audioData) ? body.audioData : [];
  const audioData = raw.filter(isValidSegment);
  if (audioData.length === 0) {
    return NextResponse.json({ error: "No valid audio segments provided" }, { status: 400 });
  }

  const decksCollection = await getDecksCollection();
  const result = await decksCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { audioData, updatedAt: new Date() } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, segments: audioData.length });
}
