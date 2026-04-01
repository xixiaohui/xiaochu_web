import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.myqcloud.com",
      },
      {
        protocol: "https",
        hostname: "hunyuan-base-prod-1258344703.cos.ap-guangzhou.myqcloud.com",
      }
    ],
  },
};

export default nextConfig;
