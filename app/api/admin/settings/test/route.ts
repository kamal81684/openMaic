import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../../../../lib/auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { loadTtsSettings, mergeTtsSettings, isValidProvider } from "../../../../../lib/tts-settings";
import { synthesizeWithSettings } from "../../../../../lib/tts";

export const runtime = "nodejs";
export const maxDuration = 60;

const TEST_TEXT = "Connection test.";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidProvider(body.provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  // Merge the (unsaved) form values over saved settings so the admin can test
  // before committing. Blank API keys fall back to the stored key.
  const current = await loadTtsSettings();
  const settings = mergeTtsSettings(current, body);

  const startedAt = Date.now();
  try {
    const result = await synthesizeWithSettings(settings, TEST_TEXT);
    const bytes = Math.round((result.audioContent.length * 3) / 4);
    return NextResponse.json({
      ok: true,
      provider: settings.provider,
      message: `Connected — received ${bytes.toLocaleString()} bytes of ${result.mimeType} audio in ${
        Date.now() - startedAt
      }ms.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ ok: false, provider: settings.provider, error: message }, { status: 200 });
  }
}
