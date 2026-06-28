import { getAllDecksForAdmin } from "../../../lib/deck-store";

import DecksPanel from "../decks-panel";

export default async function AdminDecksPage() {
  const decks = await getAllDecksForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-[28px] border border-white/70 bg-white/80 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Decks</h1>
        <p className="mt-1 text-sm text-slate-600">Every generated deck and its narration.</p>
      </header>

      <DecksPanel decks={decks} />
    </div>
  );
}
