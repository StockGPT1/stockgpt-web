import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "App loading preview", robots: { index: false, follow: false } };

export default async function LoadingReviewPreview({ params }: { params: Promise<{ step: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { step } = await params;
  if (!["first", "second", "third"].includes(step)) notFound();
  // Exercise real streaming fallbacks without slowing any customer route.
  await new Promise((resolve) => setTimeout(resolve, 12000));
  return (
    <main className="grid min-h-dvh place-items-center bg-[#072116] px-6 text-[#faf6f0]">
      <div className="max-w-md space-y-5">
        <p className="text-xs text-[#ddb159]">Development-only loading preview</p>
        <h1 className="text-3xl font-semibold">{step === "first" ? "App startup finished" : "Page finished loading"}</h1>
        <p className="text-sm text-[#faf6f0]/65">The animated chart appears at startup. Later page loads use the small indicator.</p>
        <Link href={`/loading-review-preview/${step === "first" ? "second" : "third"}`} prefetch={false} className="inline-flex min-h-11 items-center rounded-xl border border-[#ddb159]/40 px-4 text-[#ddb159]">Load another page</Link>
      </div>
    </main>
  );
}
