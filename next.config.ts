import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // AI 프롬프트 Markdown은 런타임에 fs로 읽으므로 배포 산출물에 명시적으로 포함한다.
  outputFileTracingIncludes: {
    "/**/*": ["./src/services/wikiWriter/prompts/**/*.md"],
  },
  experimental: {
    serverActions: {
      // 공유 링크 생성 시 분석된 문서 JSON을 보낸다. 기본 1MB로는 큰 단톡방이 잘린다.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
