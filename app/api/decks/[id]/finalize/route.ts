import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";

import { authOptions } from "../../../../../lib/auth";
import { getDecksCollection } from "../../../../../lib/deck-store";
import { buildPdf } from "../../../../../lib/pdf";

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

  const pdfPages: string[][] = [
    [`Topic: ${deck.topic}`, `Audience: ${deck.audience}`, `Tone: ${deck.tone}`, `Slides: ${deck.slideCount}`],
  ];

  for (const slide of deck.slides) {
    const pageLines = [
      `Slide ${slide.index}  (${slide.kind})`,
      slide.title,
      slide.subtitle ? slide.subtitle : "",
      "",
      ...slide.bullets.filter(Boolean),
      "",
      slide.speakerNotes ? `Notes: ${slide.speakerNotes}` : "",
    ].filter(Boolean);
    pdfPages.push(pageLines);
  }

  const pdfBuffer = buildPdf(pdfPages);

  await decksCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        pdfGenerated: true,
        pdfGeneratedAt: new Date(),
        pdfData: pdfBuffer.toString("base64"),
      },
    }
  );

  return NextResponse.json({ success: true });
}
