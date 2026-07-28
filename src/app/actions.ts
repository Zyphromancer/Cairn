"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "workspace"}-${suffix}`;
}

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = slugify(name);

  const { data: workspace, error } = await supabase
    .rpc("create_workspace", { p_name: name, p_slug: slug })
    .select("id, slug")
    .single();

  if (error || !workspace) {
    throw new Error(error?.message ?? "Failed to create workspace");
  }

  revalidatePath("/");
  redirect(`/w/${workspace.slug}`);
}

export async function inviteMember(workspaceId: string, formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return;

  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error("No Cairn user found with that email yet — they need to sign in once first.");
  }

  const { error } = await supabase.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: profile.id,
    role: "member",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/w`);
}

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: "owner" | "admin" | "member" | "guest",
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("id", memberId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/w");
}

export async function removeMember(workspaceId: string, memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/w");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
