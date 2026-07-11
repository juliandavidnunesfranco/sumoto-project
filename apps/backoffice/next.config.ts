import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sumo/core se consume como TS sin compilar: Next debe transpilarlo
  transpilePackages: ["@sumo/core"],
};

export default nextConfig;
