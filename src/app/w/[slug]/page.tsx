import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceHomePage({
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
    .select("id, name, icon")
    .eq("slug", slug)
    .maybeSingle();

  if (!workspace) notFound();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl">
        {workspace.icon ?? "◆"} {workspace.name}
      </h1>
      <p className="max-w-sm text-sm text-text-muted">
        Pick a page from the sidebar, or create a new one to get started.
      </p>
      <Link
        href={`/w/${slug}/settings/members`}
        className="mt-4 text-sm text-text-muted underline underline-offset-2 hover:text-text"
      >
        Manage members
      </Link>
    </main>
  );
}
