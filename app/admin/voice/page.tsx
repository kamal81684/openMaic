import { loadTtsSettings, toTtsSettingsView, TTS_PROVIDERS } from "../../../lib/tts-settings";

import AdminClient from "../admin-client";

export default async function AdminVoicePage() {
  const settings = await loadTtsSettings();

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-[28px] border border-white/70 bg-white/80 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Voice settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Choose which text-to-speech provider powers narration audio, then test the connection.
        </p>
      </header>

      <AdminClient initialSettings={toTtsSettingsView(settings)} providers={TTS_PROVIDERS} />
    </div>
  );
}
