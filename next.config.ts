import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    browserToTerminal: "warn",
    incomingRequests: false,
    serverFunctions: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.memegen.link",
      },
    ],
  },
};

export default nextConfig;
