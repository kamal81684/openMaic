import { requireAdmin } from "../../../lib/require-admin";
import { getAllUsers } from "../../../lib/user-store";

import UsersClient from "./users-client";

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const users = await getAllUsers();

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-[28px] border border-white/70 bg-white/80 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Users</h1>
        <p className="mt-1 text-sm text-slate-600">Create accounts and manage existing users.</p>
      </header>

      <UsersClient initialUsers={users} currentEmail={session.user?.email ?? ""} />
    </div>
  );
}
