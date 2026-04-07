import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore - allowedDevOrigins is required for network dev access in some Next versions
  allowedDevOrigins: ['10.96.16.37']
};

export default nextConfig;
