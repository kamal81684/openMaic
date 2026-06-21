import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { mongoClientPromise } from "../../../lib/mongodb";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = asString(body.name);
  const email = asString(body.email).toLowerCase();
  const password = asString(body.password);

  if (!name || !email || password.length < 6) {
    return NextResponse.json(
      { error: "Name, email, and a password with at least 6 characters are required" },
      { status: 400 },
    );
  }

  const client = await mongoClientPromise;
  const users = client.db().collection("users");
  const existingUser = await users.findOne({ email });

  if (existingUser) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await users.insertOne({
    name,
    email,
    passwordHash,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
