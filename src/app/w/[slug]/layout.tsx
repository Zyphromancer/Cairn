import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar/sidebar";
import { SyncQueueInit } from "@/components/sync-queue-init";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  const [{ data: pages }, { data: favorites }] = await Promise.all([
    supabase
      .from("pages")
      .select("id, parent_page_id, title, icon, visibility, archived_at, position, created_by")
      .eq("workspace_id", workspace.id)
      .order("position", { ascending: true }),
    supabase.from("page_favorites").select("page_id").eq("user_id", user.id),
  ]);

  return (
    <div className="flex min-h-full flex-1">
      <SyncQueueInit />
      <Sidebar
        workspace={workspace}
        pages={pages ?? []}
        favoritePageIds={(favorites ?? []).map((f) => f.page_id)}
        currentUserId={user.id}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
