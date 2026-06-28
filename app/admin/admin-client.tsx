"use client";

import { useState, type FormEvent } from "react";

import type { TtsProvider, TtsSettingsView } from "../../lib/tts-settings";
import { synthesizePuter } from "../../lib/puter-tts";

type ProviderMeta = { value: TtsProvider; label: string; description: string };

type AdminClientProps = {
  initialSettings: TtsSettingsView;
  providers: ProviderMeta[];
};

const inputClass =
  "w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]";
const labelClass = "block space-y-2";
const labelText = "text-sm font-medium text-slate-700";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={labelClass}>
      <span className={labelText}>{label}</span>
      {children}
      {hint ? <span className="block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

export default function AdminClient({ initialSettings, providers }: AdminClientProps) {
  const [settings, setSettings] = useState<TtsSettingsView>(initialSettings);
  // API keys are write-only: blank means "keep the stored key".
  const [keys, setKeys] = useState({ elevenlabs: "", sarvam: "", google: "" });
  const [status, setStatus] = useState<{ type: "idle" | "ok" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const [testStatus, setTestStatus] = useState<{ type: "idle" | "ok" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  type ConfigSection = "puter" | "vibevoice" | "elevenlabs" | "sarvam" | "google";

  function update<K extends ConfigSection>(section: K, patch: Partial<TtsSettingsView[K]>) {
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }

  function buildPayload() {
    return {
      provider: settings.provider,
      puter: {
        engine: settings.puter.engine,
        language: settings.puter.language,
        voice: settings.puter.voice,
      },
      vibevoice: { serverUrl: settings.vibevoice.serverUrl },
      elevenlabs: {
        apiKey: keys.elevenlabs,
        voiceId: settings.elevenlabs.voiceId,
        modelId: settings.elevenlabs.modelId,
      },
      sarvam: {
        apiKey: keys.sarvam,
        speaker: settings.sarvam.speaker,
        targetLanguageCode: settings.sarvam.targetLanguageCode,
        model: settings.sarvam.model,
      },
      google: {
        apiKey: keys.google,
        voiceName: settings.google.voiceName,
        languageCode: settings.google.languageCode,
      },
    };
  }

  async function handleTest() {
    setIsTesting(true);
    setTestStatus({ type: "idle", message: "" });

    // Puter runs in the browser, so test it client-side instead of on the server.
    if (settings.provider === "puter") {
      try {
        const started = Date.now();
        const { mimeType, data } = await synthesizePuter("Connection test.", settings.puter);
        const bytes = Math.round((data.length * 3) / 4);
        setTestStatus({
          type: "ok",
          message: `Connected — generated ${bytes.toLocaleString()} bytes of ${mimeType} audio in ${
            Date.now() - started
          }ms (in your browser).`,
        });
      } catch (err) {
        setTestStatus({ type: "error", message: err instanceof Error ? err.message : "Puter test failed" });
      } finally {
        setIsTesting(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/admin/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Test failed (${res.status})`);
      }
      if (data.ok) {
        setTestStatus({ type: "ok", message: data.message || "Connection successful." });
      } else {
        setTestStatus({ type: "error", message: data.error || "Connection failed." });
      }
    } catch (err) {
      setTestStatus({ type: "error", message: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus({ type: "idle", message: "" });

    const payload = buildPayload();

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Save failed (${res.status})`);
      }
      setSettings(data.settings as TtsSettingsView);
      setKeys({ elevenlabs: "", sarvam: "", google: "" });
      setStatus({ type: "ok", message: "Voice settings saved." });
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setIsSaving(false);
    }
  }

  const provider = settings.provider;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">Active voice provider</h2>
        <p className="mt-1 text-sm text-slate-600">All narration audio is generated by the selected provider.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {providers.map((p) => {
            const active = p.value === provider;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  setSettings((prev) => ({ ...prev, provider: p.value }));
                  setTestStatus({ type: "idle", message: "" });
                }}
                className={`rounded-3xl border px-4 py-4 text-left transition ${
                  active
                    ? "border-amber-400 bg-amber-50 shadow-[0_0_0_4px_rgba(251,191,36,0.15)]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{p.label}</span>
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      active ? "border-amber-500 bg-amber-400" : "border-slate-300 bg-white"
                    }`}
                  />
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{p.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-slate-200/70" />

      {provider === "puter" ? (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Puter (free · no setup)</h3>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700">
            Puter provides free, unlimited text-to-speech that runs in the viewer&apos;s browser — no API key
            required. This is the default when no other provider is configured. The options below are optional.
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Engine">
              <select
                className={inputClass}
                value={settings.puter.engine}
                onChange={(e) => update("puter", { engine: e.target.value })}
              >
                <option value="standard">standard</option>
                <option value="neural">neural</option>
                <option value="generative">generative</option>
              </select>
            </Field>
            <Field label="Language" hint="e.g. en-US">
              <input
                className={inputClass}
                value={settings.puter.language}
                onChange={(e) => update("puter", { language: e.target.value })}
              />
            </Field>
            <Field label="Voice" hint="optional, e.g. Joanna">
              <input
                className={inputClass}
                placeholder="default"
                value={settings.puter.voice}
                onChange={(e) => update("puter", { voice: e.target.value })}
              />
            </Field>
          </div>
        </div>
      ) : null}

      {provider === "vibevoice" ? (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">VibeVoice (self-hosted)</h3>
          <Field label="Server URL" hint="Your VibeVoice inference server, e.g. http://localhost:8080">
            <input
              className={inputClass}
              type="url"
              placeholder="http://localhost:8080"
              value={settings.vibevoice.serverUrl}
              onChange={(e) => update("vibevoice", { serverUrl: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {provider === "elevenlabs" ? (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">ElevenLabs</h3>
          <Field
            label="API key"
            hint={settings.elevenlabs.apiKeySet ? "A key is saved. Leave blank to keep it." : "No key saved yet."}
          >
            <input
              className={inputClass}
              type="password"
              placeholder={settings.elevenlabs.apiKeySet ? "••••••••  (unchanged)" : "xi-api-key"}
              value={keys.elevenlabs}
              onChange={(e) => setKeys((prev) => ({ ...prev, elevenlabs: e.target.value }))}
              autoComplete="off"
            />
          </Field>
          <Field label="Voice ID">
            <input
              className={inputClass}
              value={settings.elevenlabs.voiceId}
              onChange={(e) => update("elevenlabs", { voiceId: e.target.value })}
            />
          </Field>
          <Field label="Model ID">
            <input
              className={inputClass}
              value={settings.elevenlabs.modelId}
              onChange={(e) => update("elevenlabs", { modelId: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {provider === "sarvam" ? (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Sarvam AI</h3>
          <Field
            label="API key"
            hint={settings.sarvam.apiKeySet ? "A key is saved. Leave blank to keep it." : "No key saved yet."}
          >
            <input
              className={inputClass}
              type="password"
              placeholder={settings.sarvam.apiKeySet ? "••••••••  (unchanged)" : "api-subscription-key"}
              value={keys.sarvam}
              onChange={(e) => setKeys((prev) => ({ ...prev, sarvam: e.target.value }))}
              autoComplete="off"
            />
          </Field>
          <Field label="Speaker">
            <input
              className={inputClass}
              value={settings.sarvam.speaker}
              onChange={(e) => update("sarvam", { speaker: e.target.value })}
            />
          </Field>
          <Field label="Target language code" hint="e.g. en-IN, hi-IN, ta-IN">
            <input
              className={inputClass}
              value={settings.sarvam.targetLanguageCode}
              onChange={(e) => update("sarvam", { targetLanguageCode: e.target.value })}
            />
          </Field>
          <Field label="Model">
            <input
              className={inputClass}
              value={settings.sarvam.model}
              onChange={(e) => update("sarvam", { model: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {provider === "google" ? (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Google Cloud TTS</h3>
          <Field
            label="API key"
            hint={settings.google.apiKeySet ? "A key is saved. Leave blank to keep it." : "No key saved yet."}
          >
            <input
              className={inputClass}
              type="password"
              placeholder={settings.google.apiKeySet ? "••••••••  (unchanged)" : "Google Cloud API key"}
              value={keys.google}
              onChange={(e) => setKeys((prev) => ({ ...prev, google: e.target.value }))}
              autoComplete="off"
            />
          </Field>
          <Field label="Voice name" hint="e.g. en-US-Neural2-C">
            <input
              className={inputClass}
              value={settings.google.voiceName}
              onChange={(e) => update("google", { voiceName: e.target.value })}
            />
          </Field>
          <Field label="Language code" hint="e.g. en-US">
            <input
              className={inputClass}
              value={settings.google.languageCode}
              onChange={(e) => update("google", { languageCode: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {testStatus.type !== "idle" ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            testStatus.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {testStatus.type === "ok" ? "✓ " : "✕ "}
          {testStatus.message}
        </div>
      ) : null}

      {status.type !== "idle" ? (
        <p className={`text-sm ${status.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{status.message}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={isTesting || isSaving}
          className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          {isTesting ? "Testing..." : "Test connection"}
        </button>
        <button
          type="submit"
          disabled={isSaving || isTesting}
          className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}
