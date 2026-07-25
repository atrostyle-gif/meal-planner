import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Desktop 直下に別の lockfile がある環境でも、このアプリをルートとみなす
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
