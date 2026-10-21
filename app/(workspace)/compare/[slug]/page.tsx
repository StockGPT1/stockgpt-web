import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingSeoPage, getMarketingMetadata } from "@/components/marketing/MarketingSeoPage";
import { getMarketingPage, getMarketingPagesByKind } from "@/lib/marketingPages";

export const dynamicParams = false;

export function generateStaticParams() {
  return getMarketingPagesByKind("compare").map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getMarketingPage("compare", slug);
  return page ? getMarketingMetadata(page) : {};
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getMarketingPage("compare", slug);
  if (!page) notFound();
  return <MarketingSeoPage page={page} />;
}
