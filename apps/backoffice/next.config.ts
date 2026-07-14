import type { NextConfig } from "next";

// Imágenes del catálogo sirven desde Supabase Storage (bucket público
// "motos"); el host sale de la misma env var del cliente, nunca hardcodeado,
// para que funcione igual en local y en producción.
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");

const nextConfig: NextConfig = {
  // @sumo/core y @sumo/contracts se consumen como TS sin compilar
  transpilePackages: ["@sumo/core", "@sumo/contracts"],
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
