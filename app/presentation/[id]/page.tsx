import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";

import { authOptions } from "../../../lib/auth";
import { isAdminEmail } from "../../../lib/admin";
import { getDecksCollection } from "../../../lib/deck-store";

import PresentationViewer from "./presentation-viewer";

export default async function PresentationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/presentation");
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    redirect("/dashboard");
  }

  const decksCollection = await getDecksCollection();
  // Admins can preview any deck; regular users only their own.
  const deckQuery = isAdminEmail(session.user.email)
    ? { _id: new ObjectId(id) }
    : { _id: new ObjectId(id), userEmail: session.user.email };
  const deck = await decksCollection.findOne(deckQuery);

  if (!deck) {
    redirect("/dashboard");
  }

  return (
    <PresentationViewer
      deckId={id}
      topic={deck.topic}
      slides={deck.slides.map((s) => ({
        index: s.index,
        kind: s.kind,
        title: s.title,
        subtitle: s.subtitle,
        bullets: s.bullets,
        speakerNotes: s.speakerNotes,
      }))}
    />
  );
}
