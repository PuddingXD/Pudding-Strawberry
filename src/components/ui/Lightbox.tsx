'use client';
// 이미지 라이트박스 — 클릭 확대 보기 (배경 클릭/✕/ESC 닫기, 여러 장이면 ‹ › · 방향키 이동)
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBlobUrl, isVideoRef } from '@/lib/blobStore';

export function Lightbox({ srcs, index, onClose }: {
  srcs: string[];              // IndexedDB 파일 id 또는 URL 혼용 가능
  index: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(index);
  useEffect(() => setI(index), [index]);
  // 등록 폼에서 방금 고른 파일은 이번 세션에서 만든 blob: 주소다.
  // useBlobUrl은 blob:을 (새로고침으로 죽은) 옛 참조로 보고 거부하므로 여기서는 그대로 쓴다.
  const raw = srcs[i] ?? '';
  const live = raw.startsWith('blob:');
  const loaded = useBlobUrl(live ? undefined : raw);
  const url = live ? raw : loaded;

  /* 확대·축소 — 마우스 휠(커서 위치 기준) · 확대하면 끌어서 이동 · 더블클릭으로 확대/원래대로 ·
     두 손가락 벌리기 · 아래 +/− 버튼. 그림을 바꾸면 원래 크기로 돌아온다 */
  const MAX = 8;
  const [zm, setZm] = useState({ s: 1, x: 0, y: 0 });
  const zref = useRef(zm); zref.current = zm;
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ moved: boolean; pts: Map<number, { x: number; y: number }>; d0: number; s0: number }>({ moved: false, pts: new Map(), d0: 0, s0: 1 });
  useEffect(() => setZm({ s: 1, x: 0, y: 0 }), [i, url]);
  /** 화면 좌표 (cx, cy)를 고정점으로 배율을 ns로 — 이미지 중심은 화면 가운데에 있다 */
  const zoomAt = (ns: number, cx: number, cy: number) => {
    const { s, x, y } = zref.current;
    const n = Math.max(1, Math.min(MAX, ns));
    if (n === 1) { setZm({ s: 1, x: 0, y: 0 }); return; }
    const px = cx - window.innerWidth / 2, py = cy - window.innerHeight / 2;
    const k = n / s;
    setZm({ s: n, x: px - (px - x) * k, y: py - (py - y) * k });
  };
  const zoomCenter = (f: number) => zoomAt(zref.current.s * f, window.innerWidth / 2, window.innerHeight / 2);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // 휠은 passive가 아니어야 페이지가 같이 스크롤되지 않는다
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('video')) return;
      e.preventDefault();
      zoomAt(zref.current.s * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onDown = (e: React.PointerEvent) => {
    const d = drag.current;
    d.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    d.moved = false;
    if (d.pts.size === 2) {
      const [a, b] = [...d.pts.values()];
      d.d0 = Math.hypot(a.x - b.x, a.y - b.y); d.s0 = zref.current.s;
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const prev = d.pts.get(e.pointerId);
    if (!prev) return;
    d.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (d.pts.size === 2 && d.d0) {
      const [a, b] = [...d.pts.values()];
      zoomAt(d.s0 * Math.hypot(a.x - b.x, a.y - b.y) / d.d0, (a.x + b.x) / 2, (a.y + b.y) / 2);
      d.moved = true;
    } else if (d.pts.size === 1 && zref.current.s > 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) { d.moved = true; setZm(z => ({ ...z, x: z.x + dx, y: z.y + dy })); }
    }
  };
  const onUp = (e: React.PointerEvent) => { drag.current.pts.delete(e.pointerId); drag.current.d0 = 0; };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') zoomCenter(1.25);
      if (e.key === '-') zoomCenter(0.8);
      if (e.key === '0') setZm({ s: 1, x: 0, y: 0 });
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && srcs.length > 1) setI(x => (x - 1 + srcs.length) % srcs.length);
      if (e.key === 'ArrowRight' && srcs.length > 1) setI(x => (x + 1) % srcs.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [srcs.length, onClose]);

  return createPortal(
    <div className="lightbox" ref={box} onClick={() => { if (drag.current.moved) { drag.current.moved = false; return; } onClose(); }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && (isVideoRef(raw)
        ? <video key={url} src={url} controls autoPlay loop playsInline onClick={e => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '88vh' }} />
        : <img src={url} alt="" draggable={false} className={zm.s > 1 ? 'zoomed' : ''}
            style={{ transform: `translate(${zm.x}px, ${zm.y}px) scale(${zm.s})` }}
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => { e.stopPropagation(); if (zref.current.s > 1) setZm({ s: 1, x: 0, y: 0 }); else zoomAt(2.5, e.clientX, e.clientY); }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />)}
      {url && !isVideoRef(raw) && (
        <div className="zm" onClick={e => e.stopPropagation()}>
          <button onClick={() => zoomCenter(0.8)} aria-label="축소">−</button>
          <button className="pc" onClick={() => setZm({ s: 1, x: 0, y: 0 })} aria-label="원래 크기">{Math.round(zm.s * 100)}%</button>
          <button onClick={() => zoomCenter(1.25)} aria-label="확대">+</button>
        </div>
      )}
      {srcs.length > 1 && (
        <>
          <button className="nv l" onClick={e => { e.stopPropagation(); setI(x => (x - 1 + srcs.length) % srcs.length); }}>‹</button>
          <button className="nv r" onClick={e => { e.stopPropagation(); setI(x => (x + 1) % srcs.length); }}>›</button>
          <span className="cnt">{i + 1} / {srcs.length}</span>
        </>
      )}
      <button className="x" onClick={e => { e.stopPropagation(); onClose(); }}>✕</button>
    </div>,
    document.body,
  );
}
