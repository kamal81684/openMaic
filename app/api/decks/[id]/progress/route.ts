import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";

import { authOptions } from "../../../../../lib/auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { getDecksCollection } from "../../../../../lib/deck-store";

function deckQuery(id: string, email: string) {
  return isAdminEmail(email)
    ? { _id: new ObjectId(id) }
    : { _id: new ObjectId(id), userEmail: email };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
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
    projection: { learningProgress: 1 },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ progress: deck.learningProgress ?? null });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const currentSlideIndex = Math.max(0, toNumber(body.currentSlideIndex, 0));
  const watchedSeconds = Math.max(0, toNumber(body.watchedSeconds, 0));
  const notes = toString(body.notes, "");
  const totalSlides = Math.max(1, toNumber(body.totalSlides, 1));
  const completedPercent = clampPercent(((currentSlideIndex + 1) / totalSlides) * 100);

  const decksCollection = await getDecksCollection();
  const deck = await decksCollection.findOne(deckQuery(id, session.user.email), {
    projection: { learningProgress: 1 },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const existing = deck.learningProgress;

  const nextProgress = {
    currentSlideIndex,
    watchedSeconds: Math.max(watchedSeconds, existing?.watchedSeconds ?? 0),
    completedPercent,
    notes: notes || existing?.notes || "",
    updatedAt: new Date(),
  };

  await decksCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        learningProgress: nextProgress,
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({ progress: nextProgress });
}

