import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
    dynamicOnHover: true,
  },
};

export default nextConfig;
