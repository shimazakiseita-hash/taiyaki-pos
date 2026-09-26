import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // LAN内なので画像は最適化せずそのまま配る（ロゴを差し替えたときに古い変換結果が残らないように）
  images: { unoptimized: true },
  // 開発時にテザリングLAN上の別端末からアクセスできるようにする
  // （iPhone: 172.20.10.x / Android: 192.168.x.x や 10.x.x.x が多い）
  allowedDevOrigins: ["192.168.*.*", "172.*.*.*", "10.*.*.*"],
};

export default nextConfig;
