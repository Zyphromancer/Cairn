"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type BlockContent, type BlockType, defaultContentFor } from "@/lib/blocks/types";

export async function createBlock(params: {
  id?: string;
  pageId: string;
  type: BlockType;
  position: number;
  parentBlockId?: string | null;
  content?: BlockContent;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("blocks")
    .insert({
      ...(params.id ? { id: params.id } : {}),
      page_id: params.pageId,
      parent_block_id: params.parentBlockId ?? null,
      type: params.type,
      content: params.content ?? defaultContentFor(params.type),
      position: params.position,
      created_by: user.id,
    })
    .select("id, page_id, parent_block_id, type, content, position")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create block");
  return data;
}

export async function updateBlockContent(blockId: string, content: BlockContent) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .update({ content })
    .eq("id", blockId);
  if (error) throw new Error(error.message);
}

export async function turnIntoBlock(blockId: string, newType: BlockType, content: BlockContent) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .update({ type: newType, content })
    .eq("id", blockId);
  if (error) throw new Error(error.message);
}

export async function moveBlock(
  blockId: string,
  target: { parentBlockId: string | null; position: number },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .update({ parent_block_id: target.parentBlockId, position: target.position })
    .eq("id", blockId);
  if (error) throw new Error(error.message);
}

export async function deleteBlock(blockId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("blocks").delete().eq("id", blockId);
  if (error) throw new Error(error.message);
}

export async function revalidateWorkspace() {
  revalidatePath("/w", "layout");
}
