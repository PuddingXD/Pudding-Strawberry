'use client';
// 이전글 / 다음글 (본문 하단) — 네모 안에 ‹ › 만 있는 버튼이 양 끝에. 같은 게시판 안에서 글을 오간다.
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

export function PrevNext({ prev, next }: { prev?: PnItem | null; next?: PnItem | null }) {
  const router = useRouter();
  if (!prev && !next) return null;
  return (
    <nav className="pn" aria-label="이전글 다음글">
      <button type="button" className="pn-b" disabled={!prev}
        aria-label={prev ? `이전글: ${prev.title}` : '이전글 없음'} data-tip={prev ? `이전글 · ${prev.title}` : undefined}
        onClick={() => prev && router.push(prev.href)}><Chev dir="l" /></button>
      <button type="button" className="pn-b" disabled={!next}
        aria-label={next ? `다음글: ${next.title}` : '다음글 없음'} data-tip={next ? `다음글 · ${next.title}` : undefined}
        onClick={() => next && router.push(next.href)}><Chev dir="r" /></button>
    </nav>
  );
}

export { createdOf };
