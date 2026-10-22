"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
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
const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function uploadImage(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;
  const extension = imageTypes[value.type];
  if (!extension) throw new Error("Images must be JPEG, PNG, or WebP.");
  if (value.size > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller.");
  const path = `${userId}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("meme-images").upload(path, value, { contentType: value.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

async function removeImage(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  if (!path) return;
  const { error } = await supabase.storage.from("meme-images").remove([path]);
  if (error) throw new Error(`Media record could not be removed because its image could not be deleted: ${error.message}`);
}

function mediaDetails(formData: FormData) {
  const source_text = String(formData.get("source_text") ?? "").trim() || null;
  const prompt_text = String(formData.get("prompt_text") ?? "").trim() || "Created in the admin panel";
  if ((source_text?.length ?? 0) > 500 || prompt_text.length > 4000) throw new Error("Context must be at most 500 characters and prompt at most 4,000 characters.");
  return { source_text, prompt_text };
}

export async function createMedia(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const caption_text = String(formData.get("caption_text") ?? "").trim();
  const humor_style = String(formData.get("humor_style") ?? "");
  const details = mediaDetails(formData);
  if (!caption_text || caption_text.length > 500 || !styles.includes(humor_style)) throw new Error("Enter a caption up to 500 characters and choose a valid style.");
  const image_path = await uploadImage(supabase, user.id, formData.get("image"));
  const { data: media, error } = await supabase.from("caption_generations").insert({ user_id: user.id, caption_text, humor_style, image_path }).select("id").single();
  if (error) {
    await removeImage(supabase, image_path);
    throw new Error(error.message);
  }
  const { error: detailError } = await supabase.from("caption_generation_details").insert({ generation_id: media.id, user_id: user.id, ...details });
  if (detailError) {
    await supabase.from("caption_generations").delete().eq("id", media.id);
    await removeImage(supabase, image_path);
    throw new Error(detailError.message);
  }
  revalidatePath("/dashboard");
}

export async function updateMedia(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const caption_text = String(formData.get("caption_text") ?? "").trim();
  const humor_style = String(formData.get("humor_style") ?? "");
  const details = mediaDetails(formData);
  if (!id || !caption_text || caption_text.length > 500 || !styles.includes(humor_style)) throw new Error("Enter a valid caption and style.");
  const { data: existing, error: readError } = await supabase.from("caption_generations").select("image_path").eq("id", id).single();
  if (readError) throw new Error(readError.message);
  const newImage = await uploadImage(supabase, user.id, formData.get("image"));
  const image_path = newImage ?? existing.image_path;
  const { error } = await supabase.from("caption_generations").update({ caption_text, humor_style, image_path }).eq("id", id);
  if (error) {
    await removeImage(supabase, newImage);
    throw new Error(error.message);
  }
  const { data: detailRow, error: detailReadError } = await supabase.from("caption_generation_details").select("generation_id").eq("generation_id", id).maybeSingle();
  if (detailReadError) throw new Error(detailReadError.message);
  const detailResult = detailRow
    ? await supabase.from("caption_generation_details").update(details).eq("generation_id", id)
    : await supabase.from("caption_generation_details").insert({ generation_id: id, user_id: user.id, ...details });
  if (detailResult.error) throw new Error(detailResult.error.message);
  if (newImage && existing.image_path) await removeImage(supabase, existing.image_path);
  revalidatePath("/dashboard");
}

export async function deleteMedia(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing media ID.");
  const { data: existing, error: readError } = await supabase.from("caption_generations").select("image_path").eq("id", id).single();
  if (readError) throw new Error(readError.message);
  const { error } = await supabase.from("caption_generations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await removeImage(supabase, existing.image_path);
  revalidatePath("/dashboard");
}
