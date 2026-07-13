import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
  },
  sassOptions: {
    silenceDeprecations: ["legacy-js-api"]
  }
};

export default nextConfig;
