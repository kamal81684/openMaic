import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

import { mongoClientPromise } from "./mongodb";

type StoredUser = {
  name: string;
  email: string;
  passwordHash: string;
};

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";

        if (!email || !password) {
          return null;
        }

        const client = await mongoClientPromise;
        const usersCollection = client.db().collection<StoredUser>("users");
        const user = await usersCollection.findOne({ email });

        if (!user) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) {
        return true;
      }

      const client = await mongoClientPromise;
      const usersCollection = client.db().collection("users");
      const now = new Date();

      await usersCollection.updateOne(
        { email: user.email.toLowerCase() },
        {
          $set: {
            name: user.name ?? user.email,
            image: user.image ?? null,
            provider: "google",
            lastLoginAt: now,
          },
          $setOnInsert: {
            email: user.email.toLowerCase(),
            createdAt: now,
          },
        },
        { upsert: true },
      );

      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
};
