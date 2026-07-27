import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorkspace, signOut } from "./actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(id, name, slug, icon)")
    .eq("user_id", user.id);

  const workspaces = memberships ?? [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-xl text-accent">
          Cairn
        </h1>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-text-muted hover:text-text"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm text-text-muted">Your workspaces</h2>
        {workspaces.length === 0 && (
          <p className="text-sm text-text-muted">
            No workspaces yet — create your first one below.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {workspaces.map((m) => {
            const workspace = Array.isArray(m.workspace) ? m.workspace[0] : m.workspace;
            if (!workspace) return null;
            return (
              <li key={workspace.id}>
                <Link
                  href={`/w/${workspace.slug}`}
                  className="flex items-center justify-between rounded-[var(--radius-cairn)] border border-border bg-surface px-4 py-3 hover:bg-surface-alt"
                >
                  <span>{workspace.icon ?? "◆"} {workspace.name}</span>
                  <span className="text-xs uppercase tracking-wide text-text-muted">
                    {m.role}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-sm text-text-muted">Create a workspace</h2>
        <form action={createWorkspace} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="Acme Inc"
            className="flex-1 rounded-[var(--radius-cairn)] border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-[var(--radius-cairn)] bg-accent px-4 py-2 text-sm font-medium text-bg"
          >
            Create
          </button>
        </form>
      </section>
    </main>
  );
}
