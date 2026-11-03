'use client';
// 이전글 / 다음글 (본문 하단) — 네모 안에 ‹ › 만 있는 버튼이 양 끝에. 왼쪽 = 다음글, 오른쪽 = 이전글.
// 제목은 화면에 안 보이고, 마우스를 올리면(툴팁) · 스크린리더에서만 나온다.
import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createdOf, newestCmp } from '@/lib/order';

export interface PnItem { href: string; title: string }

/** 상세 화면이 다른 글로 바뀔 때 맨 위로 */
export function useScrollTopOnChange(key: string | undefined) {
  useEffect(() => {
    try {
      document.getElementById('appMain')?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    } catch { /* 무시 */ }
  }, [key]);
}

/** 올린 순서(생성 시각) 기준 앞·뒤 글 — 이전글 = 바로 앞에 올라온 글, 다음글 = 바로 뒤에 올라온 글.
 *  시각이 같아도 id(생성 순으로 커지는 값)로 가려 순서가 흔들리지 않는다 */
export function pickNeighbors<T extends { id: string; date?: string; createdAt?: string; created?: string }>(rows: T[], id: string): { prev: T | null; next: T | null } {
  const sorted = [...rows].sort((a, b) => -newestCmp(a, b));   // 오래된 것 → 최신
  const i = sorted.findIndex(x => x.id === id);
  if (i < 0) return { prev: null, next: null };
  return { prev: i > 0 ? sorted[i - 1] : null, next: i < sorted.length - 1 ? sorted[i + 1] : null };
}

/** 목록에 저장된 순서 그대로의 앞·뒤 (캐릭터·자관처럼 직접 끌어 정렬하는 목록) — 이전 = 목록에서 바로 위 */
export function pickByList<T extends { id: string }>(rows: T[], id: string): { prev: T | null; next: T | null } {
  const i = rows.findIndex(x => x.id === id);
  if (i < 0) return { prev: null, next: null };
  return { prev: i > 0 ? rows[i - 1] : null, next: i < rows.length - 1 ? rows[i + 1] : null };
}

/** 주소의 [id]가 바뀌면 화면을 통째로 새로 시작시킨다 — 이전글/다음글로 같은 화면에서 다른 글로 넘어갈 때
 *  탭·확대·입력 중이던 값 같은 이전 글의 상태가 남지 않게 (+ 맨 위로) */
export function keyedById(Inner: React.ComponentType): React.ComponentType {
  return function Keyed() {
    const { id } = useParams<{ id: string }>();
    useScrollTopOnChange(id);
    return <Inner key={id} />;
  };
}

const Chev = ({ dir }: { dir: 'l' | 'r' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={dir === 'l' ? 'M15 5 8 12l7 7' : 'M9 5l7 7-7 7'} /></svg>
);

export function PrevNext({ prev, next, ltr }: { prev?: PnItem | null; next?: PnItem | null; ltr?: boolean }) {
  const router = useRouter();
  // 화면에 보이는 자리 기준 — 게시판은 왼쪽 = 다음글, 자캐·자관(ltr)은 왼쪽 = 이전글
  const leftIt = ltr ? prev : next;
  const rightIt = ltr ? next : prev;
  /* 단축키 (사용자 요청) — A(ㅁ)·← = 왼쪽 ‹ 버튼, D(ㅇ)·→ = 오른쪽 › 버튼 (E는 수정, X는 삭제 — Shortcuts.tsx).
     이전글/다음글이 아니라 「화면의 어느 쪽 버튼인가」를 따르므로 게시판·자캐·자관 모두 누르는 쪽으로 간다.
     글을 쓰는 중(입력칸·에디터)이거나 창(모달·확대 보기)이 떠 있으면 반응하지 않는다 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.closest('input,textarea,select,[contenteditable]'))) return;
      if (document.querySelector('.modal-ov, .lightbox')) return;
      // 한글 입력 상태에서도 되게 자판 자리(code)로 본다 — A 자리 = ㅁ, D 자리 = ㅇ
      const left = e.code === 'KeyA' || e.key === 'ArrowLeft';
      const right = e.code === 'KeyD' || e.key === 'ArrowRight';
      const it = left ? leftIt : right ? rightIt : null;
      if (!it) return;
      e.preventDefault();
      router.push(it.href);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leftIt?.href, rightIt?.href, router]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!prev && !next) return null;
  /* 왼쪽 ‹ = 다음글, 오른쪽 › = 이전글 (v2.1 사용자 요청 — 최신 글이 위에 오는 목록 기준으로 왼쪽이 더 최신).
     툴팁에는 「이전글/다음글」 말 없이 글 제목만 */
  const Btn = ({ it, dir, label }: { it?: PnItem | null; dir: 'l' | 'r'; label: string }) => (
    <button type="button" className="pn-b" disabled={!it}
      aria-label={it ? `${label}: ${it.title}` : `${label} 없음`} data-tip={it ? it.title : undefined}
      onClick={() => it && router.push(it.href)}><Chev dir={dir} /></button>
  );
  return (
    <nav className="pn" aria-label="이전글 다음글">
     {ltr ? (
  <>
    <Btn it={prev} dir="l" label="이전글" />
    <Btn it={next} dir="r" label="다음글" />
  </>
) : (
  <>
    <Btn it={next} dir="l" label="다음글" />
    <Btn it={prev} dir="r" label="이전글" />
  </>
)}
    </nav>
  );
}

export { createdOf };
