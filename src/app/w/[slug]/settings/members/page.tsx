import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inviteMember, removeMember } from "@/app/actions";
import { RoleSelect } from "@/components/role-select";

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug, icon")
    .eq("slug", slug)
    .maybeSingle();

  if (!workspace) notFound();

  const { data: members } = await supabase
    .from("workspace_members")
    .select("id, role, user:profiles(id, email, full_name)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  const myMembership = (members ?? []).find((m) => {
    const profile = Array.isArray(m.user) ? m.user[0] : m.user;
    return profile?.id === user.id;
  });
  const canManage = myMembership?.role === "owner" || myMembership?.role === "admin";

  const inviteMemberWithWorkspace = inviteMember.bind(null, workspace.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-lg">
          {workspace.icon ?? "◆"} {workspace.name} / Members
        </h1>
      </header>

      <section className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {(members ?? []).map((m) => {
            const profile = Array.isArray(m.user) ? m.user[0] : m.user;
            if (!profile) return null;
            return (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-[var(--radius-cairn)] border border-border bg-surface px-4 py-3"
              >
                <div className="flex flex-col">
                  <span>{profile.full_name ?? profile.email}</span>
                  <span className="text-xs text-text-muted">{profile.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <RoleSelect
                    workspaceId={workspace.id}
                    memberId={m.id}
                    role={m.role}
                    disabled={!canManage}
                  />
                  {canManage && profile.id !== user.id && (
                    <form action={removeMember.bind(null, workspace.id, m.id)}>
                      <button
                        type="submit"
                        className="text-xs text-text-muted hover:text-warning"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-sm text-text-muted">Invite a member</h2>
          <form action={inviteMemberWithWorkspace} className="flex gap-2">
            <input
              type="email"
              name="email"
              required
              placeholder="teammate@example.com"
              className="flex-1 rounded-[var(--radius-cairn)] border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-[var(--radius-cairn)] bg-accent px-4 py-2 text-sm font-medium text-bg"
            >
              Invite
            </button>
          </form>
          <p className="text-xs text-text-muted">
            They need to have signed in to Cairn at least once first.
          </p>
        </section>
      )}
    </main>
  );
}
