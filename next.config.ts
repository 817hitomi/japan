import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the local dev compiler isolated from production/OpenNext builds.
  // Otherwise running `npm run deploy` while `next dev` is open can replace
  // Webpack modules underneath the dev server and break every route.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: true
  },
  sassOptions: {
    silenceDeprecations: ["legacy-js-api"]
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/ads.txt",
          destination: "/ads"
        }
      ]
    };
  }
};

export default nextConfig;
