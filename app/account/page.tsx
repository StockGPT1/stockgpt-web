import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen bg-[#0F2A1F] p-8 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-[#0F2A1F]">
        <h1 className="text-3xl font-bold">Your account</h1>

        <div className="mt-6 space-y-3">
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Plan:</strong> {profile?.subscription_status || "none"}</p>
        </div>

        <a
          href="/logout"
          className="mt-6 inline-block rounded-xl bg-[#0F2A1F] px-4 py-3 font-bold text-white"
        >
          Log out
        </a>
      </div>
    </main>
  );
}