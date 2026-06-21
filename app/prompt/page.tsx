import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../lib/auth";

import PromptClient from "./prompt-client";

export default async function PromptPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?callbackUrl=/prompt");
  }

  return <PromptClient />;
}
