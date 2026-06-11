import { stockGptIconResponse } from "@/lib/static-og-image";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  return stockGptIconResponse();
}
