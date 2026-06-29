import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";

import { authOptions } from "../../../../lib/auth";
import { isAdminEmail } from "../../../../lib/admin";
import { getDecksCollection } from "../../../../lib/deck-store";

import QuizViewer from "./quiz-viewer";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/presentation");
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    redirect("/dashboard");
  }

  const decksCollection = await getDecksCollection();
  const deckQuery = isAdminEmail(session.user.email)
    ? { _id: new ObjectId(id) }
    : { _id: new ObjectId(id), userEmail: session.user.email };
  const deck = await decksCollection.findOne(deckQuery);

  if (!deck) {
    redirect("/dashboard");
  }

  return (
    <QuizViewer
      deckId={id}
      topic={deck.topic}
    />
  );
}

