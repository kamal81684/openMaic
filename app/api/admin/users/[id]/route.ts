import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../../lib/require-admin";
import { deleteUser } from "../../../../../lib/user-store";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const result = await deleteUser(id);

  if (!result.ok) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
