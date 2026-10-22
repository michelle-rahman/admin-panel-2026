"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: profile, error } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
  if (error || !profile?.is_superadmin) redirect("/?access=denied");
  return { supabase, user };
}

export async function signIn() {
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://admin-panel-2026-lime.vercel.app";
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/auth/callback` } });
  if (error || !data.url) redirect("/?auth=error");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const styles = ["observational", "absurdist", "wholesome", "campus_lore"];

export async function createMedia(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const caption_text = String(formData.get("caption_text") ?? "").trim();
  const humor_style = String(formData.get("humor_style") ?? "");
  const image_path = String(formData.get("image_path") ?? "").trim() || null;
  if (!caption_text || caption_text.length > 500 || !styles.includes(humor_style)) throw new Error("Enter a caption up to 500 characters and choose a valid style.");
  const { error } = await supabase.from("caption_generations").insert({ user_id: user.id, caption_text, humor_style, image_path });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function updateMedia(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const caption_text = String(formData.get("caption_text") ?? "").trim();
  const humor_style = String(formData.get("humor_style") ?? "");
  const image_path = String(formData.get("image_path") ?? "").trim() || null;
  if (!id || !caption_text || caption_text.length > 500 || !styles.includes(humor_style)) throw new Error("Enter a valid caption and style.");
  const { error } = await supabase.from("caption_generations").update({ caption_text, humor_style, image_path }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function deleteMedia(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing media ID.");
  const { error } = await supabase.from("caption_generations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
