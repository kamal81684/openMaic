import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../lib/require-admin";
import { getAllUsers, createUser } from "../../../../lib/user-store";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const users = await getAllUsers();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createUser(body.name, body.email, body.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ user: result.user }, { status: 201 });
}
