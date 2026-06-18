import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable cache in development to prevent HMR/CSS crash issues
      config.cache = false;
    }
    return config;
  }
};

export default nextConfig;
