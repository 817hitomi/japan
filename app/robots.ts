import type { MetadataRoute } from "next";

const siteUrl = "https://www.japan-note.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/ads.txt"],
      disallow: ["/admin", "/api"]
    },
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
