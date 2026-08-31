import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev 전용 Next.js 표시기(N 배지)를 우하단으로 — 좌하단 플로팅 독과 겹치지 않게
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
