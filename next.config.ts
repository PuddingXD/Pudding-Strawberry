import type { NextConfig } from "next";

// 기본 보안 헤더 — 클릭재킹·MIME 스니핑·외부 스크립트 주입 등 흔한 공격을 브라우저 단에서 막는다.
// CSP는 사이트가 쓰는 외부 자원(구글 폰트, 유튜브 BGM, Supabase/Firebase)을 허용하도록 맞춰 둠.
// 새 외부 서비스를 붙이면 해당 도메인을 아래 목록에 추가해야 한다.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",                    // 다른 사이트가 내 사이트를 iframe으로 감싸는 것 금지
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com https://apis.google.com https:",   // Next 인라인 스크립트 + 유튜브 API + 구글 로그인 연동
  "style-src 'self' 'unsafe-inline' https:",                 // 눈누·외부 폰트 CSS, 로그 파일의 외부 스타일시트 허용,
  "font-src 'self' data: blob: https://fonts.gstatic.com https:",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' data: blob: https:",
  "frame-src 'self' blob: https:",
  "connect-src 'self' blob: https: wss:",     // Supabase·Firebase 등 백엔드 통신
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,                      // X-Powered-By: Next.js 노출 제거
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
