import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/editor/page-header";
import { BlockEditor } from "@/components/editor/block-editor";
import type { BlockRow } from "@/lib/blocks/types";

export default async function PageView({
  params,
}: {
  params: Promise<{ slug: string; pageId: string }>;
}) {
  const { slug, pageId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!workspace) notFound();

  const { data: page } = await supabase
    .from("pages")
    .select("id, title, icon, visibility, workspace_id")
    .eq("id", pageId)
    .maybeSingle();
  if (!page || page.workspace_id !== workspace.id) notFound();

  const [{ data: blocks }, { data: members }, { data: workspacePages }] = await Promise.all([
    supabase
      .from("blocks")
      .select("id, parent_block_id, type, content, position")
      .eq("page_id", pageId)
      .order("position", { ascending: true }),
    supabase
      .from("workspace_members")
      .select("user:profiles(id, full_name, email)")
      .eq("workspace_id", workspace.id),
    supabase
      .from("pages")
      .select("id, title, icon")
      .eq("workspace_id", workspace.id)
      .is("archived_at", null),
  ]);

  const memberItems = (members ?? [])
    .map((m) => {
      const profile = Array.isArray(m.user) ? m.user[0] : m.user;
      if (!profile) return null;
      return { id: profile.id, label: profile.full_name ?? profile.email };
    })
    .filter((m): m is { id: string; label: string } => !!m);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto pb-24">
      <PageHeader
        pageId={page.id}
        initialTitle={page.title}
        initialIcon={page.icon}
        visibility={page.visibility}
      />
      <div className="px-[var(--cairn-page-padding)] pt-4">
        <BlockEditor
          pageId={page.id}
          workspaceId={workspace.id}
          slug={slug}
          initialBlocks={(blocks ?? []) as unknown as BlockRow[]}
          members={memberItems}
          workspacePages={workspacePages ?? []}
        />
      </div>
    </div>
  );
}
