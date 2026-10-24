import { revalidatePath } from "next/cache";
import { getServerViewer } from "@/lib/server-viewer";
import { readProfilePhoto } from "@/lib/profile-photo";
import { isSameOriginProfileRequest, PROFILE_PHOTO_BUCKET, profilePhotoRevision, userProfile } from "@/lib/user-profile";

export const runtime = "nodejs";
async function removePhoto(bucket: { remove(paths: string[]): Promise<{ error: unknown }> }, path: string) {
  try {
    const { error } = await bucket.remove([path]);
    if (!error) return true;
  } catch { /* Report cleanup failure without logging the private path. */ }
  console.warn("[profile] private photo removal failed");
  return false;
}

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  const { supabase, user } = await getServerViewer();
  if (!user) return new Response(null, { status: 401, headers });
  const revision = profilePhotoRevision(user);
  if (!revision) return new Response(null, { status: 404, headers });
  const { data, error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).download(`${user.id}/${revision}.webp`);
  if (error || !data) return new Response(null, { status: 404, headers });
  return new Response(data, { headers: { ...headers, "Content-Type": "image/webp" } });
}

export async function POST(request: Request) {
  if (!isSameOriginProfileRequest(request)) return Response.json({ error: "Please save your photo from StockGPT." }, { status: 403, headers });
  const { supabase, user } = await getServerViewer();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401, headers });
  let photo: Buffer;
  try { photo = await readProfilePhoto(request); } catch { return Response.json({ error: "Choose a JPG, PNG or WebP photo smaller than 2 MB." }, { status: 400, headers }); }
  const revision = crypto.randomUUID();
  const path = `${user.id}/${revision}.webp`;
  const bucket = supabase.storage.from(PROFILE_PHOTO_BUCKET);
  const { error: uploadError } = await bucket.upload(path, photo, { contentType: "image/webp", cacheControl: "0", upsert: false });
  if (uploadError) return Response.json({ error: "Your photo couldn’t be saved. Please try again." }, { status: 503, headers });
  const { data, error } = await supabase.auth.updateUser({ data: { profile_photo_revision: revision } });
  if (error || !data.user) {
    await removePhoto(bucket, path);
    return Response.json({ error: "Your photo couldn’t be saved. Please try again." }, { status: 503, headers });
  }
  const previous = profilePhotoRevision(user);
  if (previous) await removePhoto(bucket, `${user.id}/${previous}.webp`);
  revalidatePath("/profile");
  return Response.json({ profile: userProfile(data.user) }, { headers });
}

export async function DELETE(request: Request) {
  if (!isSameOriginProfileRequest(request)) return Response.json({ error: "Please edit your photo from StockGPT." }, { status: 403, headers });
  const { supabase, user } = await getServerViewer();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401, headers });
  const previous = profilePhotoRevision(user);
  if (previous && !await removePhoto(supabase.storage.from(PROFILE_PHOTO_BUCKET), `${user.id}/${previous}.webp`)) return Response.json({ error: "Your photo couldn’t be removed. Please try again." }, { status: 503, headers });
  const { data, error } = await supabase.auth.updateUser({ data: { profile_photo_revision: null } });
  if (error || !data.user) return Response.json({ error: "Your photo couldn’t be removed. Please try again." }, { status: 503, headers });
  revalidatePath("/profile");
  return Response.json({ profile: userProfile(data.user) }, { headers });
}
