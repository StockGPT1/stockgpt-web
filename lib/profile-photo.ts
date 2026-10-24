import sharp from "sharp";
import { MAX_PROFILE_PHOTO_BYTES } from "@/lib/user-profile";

export async function encodeProfilePhoto(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_PROFILE_PHOTO_BYTES) throw new Error("Choose a photo smaller than 2 MB.");
  const image = sharp(bytes, { limitInputPixels: 16_000_000, animated: false, failOn: "error" });
  const metadata = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Choose a JPG, PNG or WebP photo.");
  return image.rotate().resize(384, 384, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
}

// Bound multipart input too, including requests without Content-Length.
export async function readProfilePhoto(request: Request) {
  const limit = MAX_PROFILE_PHOTO_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit || !request.body) throw new Error("Choose a photo smaller than 2 MB.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new Error("Choose a photo smaller than 2 MB."); }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks);
  const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) throw new Error("Please choose a photo.");
  return encodeProfilePhoto(new Uint8Array(await photo.arrayBuffer()));
}
