import type { User } from "@supabase/supabase-js";

export const PROFILE_PHOTO_BUCKET = "profile-photos";
export const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_PROFILE_NAME_LENGTH = 80;

export function profilePhotoRevision(user: Pick<User, "user_metadata">): string | null {
  const revision: unknown = user.user_metadata?.profile_photo_revision;
  return typeof revision === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(revision) ? revision : null;
}

export function userProfile(user: Pick<User, "email" | "user_metadata" | "created_at">) {
  const metadata = user.user_metadata ?? {};
  const name = [metadata.display_name, metadata.full_name, metadata.name].find(value => typeof value === "string" && value.trim());
  const revision = profilePhotoRevision(user);
  return {
    displayName: typeof name === "string" ? name.trim().slice(0, MAX_PROFILE_NAME_LENGTH) : "",
    email: user.email ?? "",
    avatarUrl: revision ? `/api/profile/photo?v=${revision}` : null,
    memberSince: user.created_at ?? null,
  };
}

export function parseProfileName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= MAX_PROFILE_NAME_LENGTH && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
}

export function isSameOriginProfileRequest(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
}
