import { revalidatePath } from "next/cache";
import { getServerViewer } from "@/lib/server-viewer";
import { isSameOriginProfileRequest, parseProfileName, userProfile } from "@/lib/user-profile";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const { user } = await getServerViewer();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401, headers });
  return Response.json({ profile: userProfile(user) }, { headers });
}

export async function PATCH(request: Request) {
  if (!isSameOriginProfileRequest(request)) return Response.json({ error: "Please save your profile from StockGPT." }, { status: 403, headers });
  const { supabase, user } = await getServerViewer();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401, headers });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Please enter a display name." }, { status: 400, headers }); }
  const displayName = parseProfileName(body?.displayName);
  if (!displayName) return Response.json({ error: "Enter a name between 1 and 80 characters." }, { status: 400, headers });
  const { data, error } = await supabase.auth.updateUser({ data: { display_name: displayName, full_name: displayName } });
  if (error || !data.user) return Response.json({ error: "Your name couldn’t be saved. Please try again." }, { status: 503, headers });
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return Response.json({ profile: userProfile(data.user) }, { headers });
}
