import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Appmusics-test",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;