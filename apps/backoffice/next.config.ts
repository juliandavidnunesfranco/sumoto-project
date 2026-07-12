import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sumo/core y @sumo/contracts se consumen como TS sin compilar
  transpilePackages: ["@sumo/core", "@sumo/contracts"],
};

export default nextConfig;
