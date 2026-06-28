import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";

import { mongoClientPromise } from "./mongodb";
import { isAdminEmail } from "./admin";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
  isAdmin: boolean;
};

type UserDoc = {
  _id?: ObjectId;
  name?: string;
  email?: string;
  passwordHash?: string;
  createdAt?: Date;
};

async function getUsersCollection() {
  const client = await mongoClientPromise;
  return client.db().collection<UserDoc>("users");
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const collection = await getUsersCollection();
  const docs = await collection
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  return docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name ?? "",
    email: doc.email ?? "",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    isAdmin: isAdminEmail(doc.email),
  }));
}

export type CreateUserResult =
  | { ok: true; user: AdminUser }
  | { ok: false; error: string; status: number };

export async function createUser(
  rawName: unknown,
  rawEmail: unknown,
  rawPassword: unknown
): Promise<CreateUserResult> {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!name || !email || password.length < 6) {
    return {
      ok: false,
      status: 400,
      error: "Name, email, and a password with at least 6 characters are required.",
    };
  }

  const collection = await getUsersCollection();
  const existing = await collection.findOne({ email });
  if (existing) {
    return { ok: false, status: 409, error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const createdAt = new Date();
  const result = await collection.insertOne({ name, email, passwordHash, createdAt });

  return {
    ok: true,
    user: {
      id: result.insertedId.toString(),
      name,
      email,
      createdAt: createdAt.toISOString(),
      isAdmin: isAdminEmail(email),
    },
  };
}

export async function deleteUser(id: string): Promise<{ ok: boolean; deleted: number }> {
  if (!ObjectId.isValid(id)) {
    return { ok: false, deleted: 0 };
  }
  const collection = await getUsersCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return { ok: result.deletedCount > 0, deleted: result.deletedCount };
}
