import { ObjectId } from "mongodb";

import { mongoClientPromise } from "./mongodb";
import type { GeneratedSlide, GenerateDeckInput } from "./slide-generator";
import type { NarrationSegment } from "./narration";

export type StoredDeck = GenerateDeckInput & {
  _id?: ObjectId;
  userId: string;
  userName: string;
  userEmail: string;
  slides: GeneratedSlide[];
  createdAt: Date;
  updatedAt: Date;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: Date;
  narration?: {
    totalDuration: number;
    script: NarrationSegment[];
    createdAt: Date;
  };
  audioData?: {
    slideIndex: number;
    mimeType: string;
    data: string;
  }[];
};

export type DeckSummary = {
  id: string;
  topic: string;
  slideCount: number;
  audience: string;
  tone: string;
  slides: GeneratedSlide[];
  createdAt: string;
  updatedAt: string;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string | null;
  hasNarration?: boolean;
};

export async function getDecksCollection() {
  const client = await mongoClientPromise;
  return client.db().collection<StoredDeck>("slideDecks");
}

export type AdminDeckSlide = {
  index: number;
  kind: string;
  title: string;
  subtitle?: string;
  bullets: string[];
};

export type AdminDeckSummary = {
  id: string;
  topic: string;
  audience: string;
  tone: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  slideCount: number;
  slides: AdminDeckSlide[];
  narration: {
    totalDuration: number;
    segments: { slideIndex: number; estimatedDuration: number; text: string }[];
  } | null;
  audioCount: number;
};

/** Every deck across all users, without the heavy base64 audio payload. Admin-only. */
export async function getAllDecksForAdmin(limit = 100): Promise<AdminDeckSummary[]> {
  const collection = await getDecksCollection();

  const docs = await collection
    .aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $project: {
          topic: 1,
          audience: 1,
          tone: 1,
          userName: 1,
          userEmail: 1,
          createdAt: 1,
          slideCount: 1,
          slides: 1,
          narration: 1,
          audioCount: { $size: { $ifNull: ["$audioData", []] } },
        },
      },
    ])
    .toArray();

  return docs.map((doc) => {
    const slides = Array.isArray(doc.slides) ? (doc.slides as GeneratedSlide[]) : [];
    const narration = doc.narration as StoredDeck["narration"] | undefined;

    return {
      id: doc._id.toString(),
      topic: doc.topic ?? "Untitled",
      audience: doc.audience ?? "",
      tone: doc.tone ?? "",
      userName: doc.userName ?? "",
      userEmail: doc.userEmail ?? "",
      createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
      slideCount: typeof doc.slideCount === "number" ? doc.slideCount : slides.length,
      slides: slides.map((s) => ({
        index: s.index,
        kind: s.kind,
        title: s.title,
        subtitle: s.subtitle,
        bullets: Array.isArray(s.bullets) ? s.bullets : [],
      })),
      narration: narration
        ? {
            totalDuration: narration.totalDuration,
            segments: narration.script.map((seg) => ({
              slideIndex: seg.slideIndex,
              estimatedDuration: seg.estimatedDuration,
              text: seg.text,
            })),
          }
        : null,
      audioCount: typeof doc.audioCount === "number" ? doc.audioCount : 0,
    };
  });
}

export function toDeckSummary(deck: StoredDeck): DeckSummary {
  return {
    id: deck._id!.toString(),
    topic: deck.topic,
    slideCount: deck.slideCount,
    audience: deck.audience,
    tone: deck.tone,
    slides: deck.slides,
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
    pdfGenerated: deck.pdfGenerated,
    pdfGeneratedAt: deck.pdfGeneratedAt?.toISOString() ?? null,
    hasNarration: !!deck.narration,
  };
}
