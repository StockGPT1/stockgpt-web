import type { MetadataRoute } from "next";
import { marketingPages } from "@/lib/marketingPages";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const marketingEntries: MetadataRoute.Sitemap = marketingPages.map((page) => ({
    url: `https://stockgpt.pro/${page.kind}/${page.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: page.kind === "use-cases" ? 0.8 : 0.7,
  }));

  return [
    { url: "https://stockgpt.pro/", lastModified, changeFrequency: "weekly", priority: 1 },
    { url: "https://stockgpt.pro/demo", lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: "https://stockgpt.pro/about", lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: "https://stockgpt.pro/pricing", lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: "https://stockgpt.pro/affiliate", lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: "https://stockgpt.pro/legal", lastModified, changeFrequency: "yearly", priority: 0.3 },
    ...marketingEntries,
  ];
}
