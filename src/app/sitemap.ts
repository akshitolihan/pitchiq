import type { MetadataRoute } from "next";
import fixturesData from "@/data/fixtures.json";

const BASE = "https://pitchiq-eta.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const fixtures: { id: number }[] = fixturesData.fixtures ?? [];
  const matchPages = fixtures.map((f) => ({
    url: `${BASE}/matches/${f.id}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/fifa`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    ...matchPages,
  ];
}
