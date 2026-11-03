'use client';
// 단축키 (PC 전용) — 글을 쓰고 있지 않을 때 W(글쓰기·추가) / E(수정) / X(삭제)를 누르면
// (삭제는 원래 D였는데 A·D를 이전글/다음글에 쓰게 되어 X로 옮겼다 — 사용자 요청)
// 지금 화면에 있는 해당 버튼을 대신 눌러 준다.
//  · 화면에 해당 버튼이 「딱 하나」일 때만 동작 (여러 개면 잘못 누르지 않도록 무시)
//  · 입력칸·에디터에 글을 쓰는 중, Ctrl/Alt/Cmd 조합, 한글 입력 중에는 동작하지 않음
//  · 삭제는 원래 버튼과 똑같이 확인창이 먼저 뜬다
import { useEffect } from 'react';

const RULES: Record<string, RegExp> = {
  KeyW: /^(?:[＋+✎]\s*)?(?:ADD|WRITE|NEW)\b|^(?:[＋+✎]\s*)?글쓰기$/i,
  KeyE: /^(?:✎\s*)?(?:EDIT|수정|정보수정)$/i,
  KeyX: /^(?:DELETE|삭제)$/i,
};

function visible(el: HTMLElement) {
  if ((el as HTMLButtonElement).disabled) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  return getComputedStyle(el).visibility !== 'hidden';
}

export function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 마우스를 쓰는 PC·노트북에서만 (폰·태블릿은 제외)
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing || e.repeat) return;
      const re = RULES[e.code];
      if (!re) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // 열려 있는 팝업(확인창 등)이 있으면 그 뒤 버튼은 누르지 않는다
      if (document.querySelector('[role="dialog"], .modal-ov')) return;
      const hits = Array.from(document.querySelectorAll<HTMLElement>('button, a'))
        .filter(el => re.test((el.textContent ?? '').trim()) && visible(el));
      if (hits.length !== 1) return;
      e.preventDefault();
      hits[0].click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
