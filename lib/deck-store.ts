import { ObjectId } from "mongodb";

import { mongoClientPromise } from "./mongodb";
import type { GeneratedSlide, GenerateDeckInput } from "./slide-generator";

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
};

export async function getDecksCollection() {
  const client = await mongoClientPromise;
  return client.db().collection<StoredDeck>("slideDecks");
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
  };
}
