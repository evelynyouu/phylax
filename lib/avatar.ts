import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_BUCKET = "avatars";

export type AvatarType = "image/png" | "image/jpeg" | "image/webp";

/** The image type from the file's first bytes. The declared type and file name are never trusted. */
export function sniffImage(bytes: Uint8Array): AvatarType | null {
  const at = (i: number, sig: number[]) => sig.every((b, k) => bytes[i + k] === b);
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  return null;
}

export function avatarObjectPath(userId: string): string {
  return `${userId}/avatar`;
}

/** A one hour signed URL for the photo, or null when there is none or anything goes wrong. */
export async function avatarSignedUrl(client: SupabaseClient, path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await client.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600);
    return error || !data?.signedUrl ? null : data.signedUrl;
  } catch {
    return null;
  }
}
