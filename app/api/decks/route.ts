import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../../lib/auth";
import { getDecksCollection, toDeckSummary } from "../../../lib/deck-store";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decksCollection = await getDecksCollection();
  const decks = await decksCollection
    .find({ userEmail: session.user.email })
    .sort({ createdAt: -1 })
    .limit(24)
    .toArray();

  return NextResponse.json({ decks: decks.map(toDeckSummary) });
}
