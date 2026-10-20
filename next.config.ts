import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Permite subir briefs, fotos y videos de referencia
    serverActions: { bodySizeLimit: "200mb" },
  },
  serverExternalPackages: ["mammoth", "ffmpeg-static"],
};

export default nextConfig;
