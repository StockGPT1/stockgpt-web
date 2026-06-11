import { readFile } from "fs/promises";
import path from "path";

const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

let imagePromise: Promise<Buffer> | null = null;

function getOgImage() {
  imagePromise ??= readFile(path.join(process.cwd(), "public", "og-image.png"));
  return imagePromise;
}

export async function stockGptIconResponse() {
  const file = await getOgImage();
  const body = new Uint8Array(file);

  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
