import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev 전용 Next.js 표시기(N 배지)를 우상단으로 — 좌하단 독·우하단 참석 위젯과 겹치지 않게
  devIndicators: { position: "top-right" },
};

export default nextConfig;
