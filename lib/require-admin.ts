import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";

import { authOptions } from "./auth";
import { isAdminEmail } from "./admin";

/** For server pages/layouts: redirect non-admins away, return the session for admins. */
export async function requireAdmin(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/admin");
  }
  if (!isAdminEmail(session.user.email)) {
    redirect("/dashboard");
  }
  return session;
}

type AdminApiOk = { ok: true; email: string };
type AdminApiErr = { ok: false; response: NextResponse };

/** For API routes: returns the admin email or a ready-to-return error response. */
export async function requireAdminApi(): Promise<AdminApiOk | AdminApiErr> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdminEmail(session.user.email)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, email: session.user.email };
}
