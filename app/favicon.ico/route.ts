import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const file = await readFile(path.join(process.cwd(), "public", "og-image.png"));

  return new Response(file, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
