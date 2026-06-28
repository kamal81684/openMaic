import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../../../lib/auth";
import { isAdminEmail } from "../../../../lib/admin";
import {
  loadTtsSettings,
  saveTtsSettings,
  toTtsSettingsView,
  mergeTtsSettings,
  isValidProvider,
  TTS_PROVIDERS,
} from "../../../../lib/tts-settings";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdminEmail(session.user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { email: session.user.email };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const settings = await loadTtsSettings();
  return NextResponse.json({ settings: toTtsSettingsView(settings), providers: TTS_PROVIDERS });
}

export async function PUT(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidProvider(body.provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const current = await loadTtsSettings();
  const next = mergeTtsSettings(current, body);

  await saveTtsSettings(next);
  return NextResponse.json({ settings: toTtsSettingsView(next), providers: TTS_PROVIDERS });
}
