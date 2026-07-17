import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
