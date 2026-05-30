import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: "https://stockgpt.pro/", lastModified, changeFrequency: "weekly", priority: 1 },
    { url: "https://stockgpt.pro/about", lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: "https://stockgpt.pro/pricing", lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: "https://stockgpt.pro/affiliate", lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: "https://stockgpt.pro/legal", lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
