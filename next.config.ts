import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
