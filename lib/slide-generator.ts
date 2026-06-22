export type SlideKind = "cover" | "agenda" | "content" | "takeaway" | "closing";

export type GeneratedSlide = {
  index: number;
  kind: SlideKind;
  title: string;
  subtitle?: string;
  bullets: string[];
  speakerNotes: string;
};

export type GenerateDeckInput = {
  topic: string;
  slideCount: number;
  audience: string;
  tone: string;
};

export async function generateDeck(input: GenerateDeckInput): Promise<{ slides: GeneratedSlide[]; deckId?: string }> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Deck generation failed with status ${response.status}`);
  }

  return response.json();
}
