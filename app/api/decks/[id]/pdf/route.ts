import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../../../../lib/auth";
import { getDecksCollection } from "../../../../../lib/deck-store";
import { buildPdf } from "../../../../../lib/pdf";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });
  }

  const decksCollection = await getDecksCollection();
  const deck = await decksCollection.findOne({
    _id: new ObjectId(id),
    userEmail: session.user.email,
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const pdfPages = [
    [
      `Topic: ${deck.topic}`,
      `Audience: ${deck.audience}`,
      `Tone: ${deck.tone}`,
      `Slides: ${deck.slideCount}`,
    ],
    ...deck.slides.map((slide) => [
      `Slide ${slide.index}: ${slide.title}`,
      slide.subtitle ? `Subtitle: ${slide.subtitle}` : "",
      ...slide.bullets.map((bullet) => `• ${bullet}`),
      `Notes: ${slide.speakerNotes}`,
    ]),
  ];

  const pdfBuffer = buildPdf(pdfPages);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="openmaic-${deck.topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "deck"}.pdf"`,
    },
  });
}
