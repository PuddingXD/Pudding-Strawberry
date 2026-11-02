// 긴 글(문서) 도구 — 자캐 추가 탭 · 자관 문서 탭이 함께 쓴다.
//  · prepareDoc : 본문을 안전하게 걸러 제목(1~3)에 이동용 id를 달고, 목차를 뽑는다
//  · fileToHtml : txt / md / html 파일을 에디터에 넣을 HTML로 (구글 문서 → 다운로드 .md/.html 도 가능)
import { marked } from 'marked';
import { sanitizeHtml } from '@/lib/sanitize';

/** 문서 한 편 — 자캐의 추가 탭, 자관의 문서 탭을 같은 모양으로 읽기 화면에 넘긴다 */
export interface DocItem { id: string; icon: string; title: string; subtitle?: string; html: string; size?: number }

/** 문서 본문 기본 글자 크기(px) — 전체 읽기 화면 13, 탭 안에 바로 보이는 본문 14. 문서마다 바꿀 수 있다 */
export const DEFAULT_DOC_SIZE = 13;
export const DEFAULT_TAB_SIZE = 14;
export interface TocItem { id: string; level: 1 | 2 | 3; text: string }

/** 본문 정리 + 제목 id 달기 + 목차 — 브라우저에서만 동작(SSR에서는 빈 값) */
export function prepareDoc(html: string, prefix = 'h'): { html: string; toc: TocItem[] } {
  if (typeof window === 'undefined') return { html: '', toc: [] };
  const clean = sanitizeHtml(html || '');
  const doc = new DOMParser().parseFromString(`<div id="__r">${clean}</div>`, 'text/html');
  const root = doc.getElementById('__r');
  const toc: TocItem[] = [];
  root?.querySelectorAll('h1,h2,h3').forEach((h, i) => {
    const text = (h.textContent ?? '').trim();
    if (!text) return;
    const id = `${prefix}-${i}`;
    h.setAttribute('id', id);
    toc.push({ id, level: Number(h.tagName[1]) as 1 | 2 | 3, text });
  });
  return { html: root?.innerHTML ?? clean, toc };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** txt: 빈 줄 = 문단 나눔, 한 줄 바꿈 = 줄 바꿈, 빈 줄이 더 있으면 그만큼 빈 문단을 남긴다(엔터 그대로) */
function textToHtml(t: string): string {
  const src = t.replace(/\r\n?/g, '\n').trim();
  if (!src) return '';
  let out = '';
  for (const part of src.split(/(\n{2,})/)) {
    if (/^\n{2,}$/.test(part)) out += '<p></p>'.repeat(part.length - 2);
    else if (part.trim()) out += `<p>${esc(part.trim()).replace(/\n/g, '<br>')}</p>`;
  }
  return out;
}

/** 파일 → 에디터용 HTML. 지원: .txt · .md/.markdown · .html/.htm (그 외는 에러) */
export async function fileToHtml(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const text = (await file.text()).replace(/^﻿/, '');
  if (/\.(md|markdown)$/.test(name)) return sanitizeHtml(marked.parse(text, { async: false }) as string);
  if (/\.html?$/.test(name)) {
    const d = new DOMParser().parseFromString(text, 'text/html');
    d.querySelectorAll('style,script,meta,link,title').forEach(n => n.remove());
    return sanitizeHtml(d.body.innerHTML);
  }
  if (/\.txt$/.test(name) || file.type === 'text/plain') return textToHtml(text);
  throw new Error('txt · md · html 파일만 불러올 수 있습니다');
}
