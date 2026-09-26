import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // 開発時にテザリングLAN上の別端末からアクセスできるようにする
  // （iPhone: 172.20.10.x / Android: 192.168.x.x や 10.x.x.x が多い）
  allowedDevOrigins: ["192.168.*.*", "172.*.*.*", "10.*.*.*"],
};

export default nextConfig;
