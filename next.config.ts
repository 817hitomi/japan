import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
