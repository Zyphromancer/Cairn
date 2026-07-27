"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createPage(params: {
  workspaceId: string;
  parentPageId?: string | null;
  position: number;
  visibility?: "private" | "workspace";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("pages")
    .insert({
      workspace_id: params.workspaceId,
      parent_page_id: params.parentPageId ?? null,
      position: params.position,
      visibility: params.visibility ?? "workspace",
      created_by: user.id,
    })
    .select("id, title, icon, parent_page_id, visibility, position")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create page");

  revalidatePath("/w", "layout");
  return data;
}

export async function createChildPage(params: {
  pageId: string;
  workspaceId: string;
  blockPosition: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: page, error } = await supabase
    .from("pages")
    .insert({
      workspace_id: params.workspaceId,
      parent_page_id: params.pageId,
      position: 0,
      created_by: user.id,
    })
    .select("id, title, icon")
    .single();

  if (error || !page) throw new Error(error?.message ?? "Failed to create page");

  const { error: blockError } = await supabase.from("blocks").insert({
    page_id: params.pageId,
    type: "child_page",
    content: { pageId: page.id },
    position: params.blockPosition,
    created_by: user.id,
  });

  if (blockError) throw new Error(blockError.message);

  revalidatePath("/w", "layout");
  return page;
}

export async function updatePage(
  pageId: string,
  patch: Partial<{
    title: string;
    icon: string | null;
    coverUrl: string | null;
    visibility: "private" | "workspace";
  }>,
) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.icon !== undefined) update.icon = patch.icon;
  if (patch.coverUrl !== undefined) update.cover_url = patch.coverUrl;
  if (patch.visibility !== undefined) update.visibility = patch.visibility;

  const { error } = await supabase.from("pages").update(update).eq("id", pageId);
  if (error) throw new Error(error.message);

  revalidatePath("/w", "layout");
}

export async function movePage(
  pageId: string,
  target: { parentPageId: string | null; position: number },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({ parent_page_id: target.parentPageId, position: target.position })
    .eq("id", pageId);
  if (error) throw new Error(error.message);

  revalidatePath("/w", "layout");
}

export async function toggleFavorite(pageId: string, favorited: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  if (favorited) {
    const { error } = await supabase
      .from("page_favorites")
      .insert({ user_id: user.id, page_id: pageId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("page_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("page_id", pageId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/w", "layout");
}

export async function trashPage(pageId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", pageId);
  if (error) throw new Error(error.message);

  revalidatePath("/w", "layout");
}

export async function restorePage(pageId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({ archived_at: null })
    .eq("id", pageId);
  if (error) throw new Error(error.message);

  revalidatePath("/w", "layout");
}

export async function deletePagePermanently(pageId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pages").delete().eq("id", pageId);
  if (error) throw new Error(error.message);

  revalidatePath("/w", "layout");
}
