'use client';
// 당겨서 새로고침 (모바일) — 이 홈은 화면 전체가 아니라 #appMain 안에서만 스크롤되어
// 브라우저 기본 당겨서 새로고침이 동작하지 않는다. 맨 위에서 아래로 길게 끌면 같은 효과를 낸다.
// 브라우저 새로고침이 아니라 페이지만 다시 그린다(refreshPage) — BGM은 끊기지 않는다.
import React, { useEffect, useRef, useState } from 'react';
import { refreshPage } from '@/lib/pageRefresh';

const TRIGGER = 72;     // 이만큼(px, 감쇠 적용 후) 끌고 놓으면 새로고침
const MAX = 110;

/** 이 요소 안에서 시작한 끌기는 새로고침으로 보지 않는다 — 입력·에디터·자체 스크롤 영역·고정 레이어(모달) */
function blocked(target: EventTarget | null, root: HTMLElement): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== root) {
    if (el.matches('input,textarea,select,[contenteditable="true"],.re-wrap,.drag-h,[draggable="true"],[data-no-ptr]')) return true;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') return true;
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) return true;
    el = el.parentElement;
  }
  return false;
}

export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState(56);   // 본문 영역이 시작하는 화면 높이 (상단바 바로 아래)
  const st = useRef({ y0: 0, x0: 0, active: false, pulling: false, dist: 0 });

  useEffect(() => {
    const root = document.getElementById('appMain');
    if (!root) return;
    const s = st.current;

    const start = (e: TouchEvent) => {
      s.active = false; s.pulling = false; s.dist = 0;
      if (e.touches.length !== 1 || root.scrollTop > 0 || document.body.classList.contains('edit-on')) return;
      if (blocked(e.target, root)) return;
      setTop(Math.round(root.getBoundingClientRect().top));
      s.active = true; s.y0 = e.touches[0].clientY; s.x0 = e.touches[0].clientX;
    };
    const move = (e: TouchEvent) => {
      if (!s.active) return;
      const dy = e.touches[0].clientY - s.y0;
      const dx = e.touches[0].clientX - s.x0;
      if (!s.pulling) {
        if (dy < 0 || root.scrollTop > 0) { s.active = false; return; }   // 위로 밀거나 스크롤이 시작되면 포기
        if (dy < 10) return;
        if (Math.abs(dx) > dy) { s.active = false; return; }              // 가로 움직임이면 포기
        s.pulling = true;
      }
      e.preventDefault();                                                  // 끄는 동안 화면이 같이 끌리지 않게
      s.dist = Math.min(MAX, dy * 0.5);
      setPull(s.dist);
    };
    const end = () => {
      if (s.pulling && s.dist >= TRIGGER) {
        setBusy(true);
        setPull(TRIGGER * 0.7);
        refreshPage();
        window.setTimeout(() => { setBusy(false); setPull(0); }, 700);
      } else setPull(0);
      s.active = false; s.pulling = false; s.dist = 0;
    };

    root.addEventListener('touchstart', start, { passive: true });
    root.addEventListener('touchmove', move, { passive: false });
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', end);
    return () => {
      root.removeEventListener('touchstart', start);
      root.removeEventListener('touchmove', move);
      root.removeEventListener('touchend', end);
      root.removeEventListener('touchcancel', end);
    };
  }, []);

  if (pull <= 0 && !busy) return null;
  const ready = pull >= TRIGGER;
  return (
    <div aria-hidden style={{
      position: 'fixed', left: 0, right: 0, top: top + 4, zIndex: 60, display: 'flex', justifyContent: 'center',
      pointerEvents: 'none', transform: `translateY(${pull - 30}px)`, opacity: Math.min(1, pull / 40), transition: s0(busy),
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: 'var(--panel-bg,#fff)', boxShadow: '0 2px 10px rgba(0,0,0,.2)',
        display: 'grid', placeItems: 'center', fontSize: 15, color: ready || busy ? 'var(--accent)' : 'var(--faint)',
        transform: busy ? undefined : `rotate(${pull * 4}deg)`, animation: busy ? 'ptr-spin .8s linear infinite' : undefined,
      }}>↻</div>
    </div>
  );
}
const s0 = (busy: boolean) => (busy ? 'transform .2s' : 'none');
