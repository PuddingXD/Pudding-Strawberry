// HTML 보안 정책 (6.3 확정) — 스크립트 실행 불허, 스타일은 유지
// <script>·인라인 이벤트(onclick 등)·javascript: 링크 제거. DOMPurify 사용.
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export type PostMode = 'md' | 'html';

let hooked = false;
function installHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    // 새 탭 링크는 원래 창을 건드리지 못하게 (탭내빙 방지)
    if (node.tagName === 'A' && node.getAttribute('target')) node.setAttribute('rel', 'noopener noreferrer');
    // 글 안의 스타일이 화면 전체를 덮어 가짜 로그인창 등을 만들지 못하게 — 화면 고정(fixed)만 차단 (일반 꾸미기 스타일은 그대로)
    const st = node.getAttribute?.('style');
    if (st) {
      const clean = st
        .replace(/position\s*:\s*fixed\s*;?/gi, '')
        .replace(/expression\s*\(|behavior\s*:|-moz-binding[^;]*;?/gi, '');
      if (clean !== st) node.setAttribute('style', clean);
    }
  });
}

export function sanitizeHtml(html: string): string {
  // DOMPurify는 브라우저 DOM 필요 — SSR 프리렌더 시 빈 값 (클라이언트에서 렌더됨)
  if (typeof window === 'undefined') return '';
  installHooks();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['style', 'target', 'align'],   // 스타일 자유 (6.3)
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['formaction', 'srcdoc'],
  });
}

/** MD/HTML 본문 → 렌더 가능한 안전한 HTML */
export function renderBody(mode: PostMode, body: string): string {
  const raw = mode === 'md' ? (marked.parse(body, { async: false }) as string) : body;
  return sanitizeHtml(raw);
}
