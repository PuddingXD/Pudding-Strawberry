'use client';
// 자관 페이지 스티커 — 편집모드에서 이미지를 올려 페이지 위에 자유롭게 놓는다 (홈 장식 이미지와 같은 편집모드)
//  · 위치: 가로는 페이지 폭 대비 비율(화면이 좁아도 같은 자리), 세로는 페이지 맨 위에서의 px
//  · 편집모드: 끌어서 이동 · 오른쪽 아래 ◢를 끌어 크기 · ✕ 삭제 · 누르면 맨 앞으로
//  · 평소에는 클릭이 뒤의 내용으로 통과한다
import React, { useEffect, useRef, useState } from 'react';
import { useMainStore } from '@/lib/mainStore';
import { useBlobUrl, putBlob } from '@/lib/blobStore';
import { newId } from '@/lib/postStore';
import { useToast } from '@/components/ui/Toast';
import type { RelSticker } from '@/lib/charStore';

const MIN_W = 0.03, MAX_W = 1.2;

function Img({ id, sticker, edit, live, onDown, onResize, onRot, onResetRot, onDel }: {
  id: string; sticker: RelSticker; edit: boolean; live?: Partial<RelSticker>;
  onDown: (e: React.PointerEvent) => void; onResize: (e: React.PointerEvent) => void;
  onRot: (e: React.PointerEvent) => void; onResetRot: () => void; onDel: () => void;
}) {
  const url = useBlobUrl(sticker.imgId);
  if (!url) return null;
  const s = { ...sticker, ...live };
  return (
    <div data-sticker={id}
      style={{
        position: 'absolute', left: `${s.x * 100}%`, top: s.y, width: `${s.w * 100}%`,
        transform: s.rot ? `rotate(${s.rot}deg)` : undefined,
        pointerEvents: edit ? 'auto' : 'none', touchAction: 'none', userSelect: 'none',
        cursor: edit ? 'var(--cur-drag,grab)' : undefined,
        outline: edit ? '1.5px dashed rgba(201,106,115,.7)' : undefined, outlineOffset: 2,
      }}
      onPointerDown={edit ? onDown : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" draggable={false} style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none' }} />
      {edit && (
        <>
          <span title="삭제" onPointerDown={e => e.stopPropagation()} onClick={onDel}
            style={{ position: 'absolute', top: -10, right: -10, width: 20, height: 20, borderRadius: '50%', background: '#fff', color: '#a63a45', border: '1px solid #c96a73', display: 'grid', placeItems: 'center', fontSize: 11, cursor: 'var(--cur-pointer,pointer)', lineHeight: 1 }}>✕</span>
          <span title="드래그로 기울기 · 더블클릭 = 초기화" onPointerDown={onRot} onDoubleClick={onResetRot}
            style={{ position: 'absolute', left: -7, top: -7, width: 15, height: 15, borderRadius: '50%', background: '#c96a73', border: '2px solid #fff', cursor: 'crosshair', boxShadow: '0 2px 6px rgba(0,0,0,.35)' }} />
          <span title="크기 조절" onPointerDown={onResize}
            style={{ position: 'absolute', right: -7, bottom: -7, width: 16, height: 16, borderRadius: 4, background: '#fff', border: '1px solid #c96a73', display: 'grid', placeItems: 'center', fontSize: 9, color: '#a63a45', cursor: 'nwse-resize', lineHeight: 1 }}>◢</span>
        </>
      )}
    </div>
  );
}

export function StickerLayer({ stickers, editable, onChange }: {
  stickers: RelSticker[]; editable: boolean; onChange: (next: RelSticker[]) => void;
}) {
  const toast = useToast();
  const { gridOn } = useMainStore();
  const gridRef = useRef(gridOn);
  gridRef.current = gridOn;
  const layerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState<Record<string, Partial<RelSticker>>>({});
  const drag = useRef<{ id: string; mode: 'move' | 'size' | 'rot'; px: number; py: number; s: RelSticker; W: number; cx: number; cy: number; a0: number } | null>(null);
  const latest = useRef(stickers);
  latest.current = stickers;
  const liveRef = useRef(live);
  liveRef.current = live;
  const changeRef = useRef(onChange);   // 이벤트 리스너는 한 번만 달리므로 최신 저장 함수를 ref로
  changeRef.current = onChange;

  const box = () => layerRef.current?.parentElement?.getBoundingClientRect();

  const begin = (id: string, mode: 'move' | 'size' | 'rot') => (e: React.PointerEvent) => {
    const s = latest.current.find(x => x.id === id);
    const r = box();
    if (!s || !r) return;
    e.preventDefault(); e.stopPropagation();
    // 회전은 스티커 중심 기준
    const el = (e.currentTarget as HTMLElement).closest('[data-sticker]') as HTMLElement | null;
    const er = el?.getBoundingClientRect();
    const cx = er ? er.left + er.width / 2 : 0, cy = er ? er.top + er.height / 2 : 0;
    drag.current = { id, mode, px: e.clientX, py: e.clientY, s, W: r.width, cx, cy, a0: Math.atan2(e.clientY - cy, e.clientX - cx) };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.px, dy = e.clientY - d.py;
      const snap = gridRef.current;   // 홈과 같은 10px 격자 (그리드 켰을 때만)
      const g = (v: number) => Math.round(v / 10) * 10;
      if (d.mode === 'rot') {
        let deg = (d.s.rot ?? 0) + (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) - d.a0) * 180 / Math.PI;
        deg = snap ? Math.round(deg / 5) * 5 : Math.round(deg);
        if (deg > 180) deg -= 360;
        if (deg < -180) deg += 360;
        setLive({ [d.id]: { rot: deg } });
      } else if (d.mode === 'move') {
        let x = d.s.x + dx / d.W, y = d.s.y + dy;
        if (e.shiftKey) x = (1 - d.s.w) / 2;   // Shift = 가로 가운데 (홈과 동일)
        else if (snap) x = g(x * d.W) / d.W;
        if (snap) y = g(y);
        setLive({ [d.id]: { x: Math.max(-0.1, Math.min(1.05 - d.s.w, x)), y: Math.max(0, y) } });
      } else {
        let w = d.s.w + dx / d.W;
        if (snap) w = g(w * d.W) / d.W;
        setLive({ [d.id]: { w: Math.max(MIN_W, Math.min(MAX_W, w)) } });
      }
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const patch = liveRef.current[d.id];
      const cur = latest.current;
      if (patch) {
        // 누른 스티커는 맨 앞으로 (배열 끝)
        const merged = cur.map(x => (x.id === d.id ? { ...x, ...patch } : x));
        const me = merged.find(x => x.id === d.id)!;
        changeRef.current([...merged.filter(x => x.id !== d.id), me]);
      } else {
        const me = cur.find(x => x.id === d.id);
        if (me && cur[cur.length - 1]?.id !== d.id) changeRef.current([...cur.filter(x => x.id !== d.id), me]);
      }
      setLive({});
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async (list: FileList | null) => {
    if (!list || !list.length) return;
    const r = box();
    const added: RelSticker[] = [];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/')) continue;
      const imgId = await putBlob(f);
      // 지금 보고 있는 화면 가운데쯤에 놓는다
      const y = r ? Math.max(40, window.innerHeight / 2 - r.top - 60 + added.length * 24) : 120;
      added.push({ id: newId(), imgId, x: 0.4 + added.length * 0.03, y, w: 0.2 });
    }
    if (added.length) { onChange([...latest.current, ...added]); toast(`스티커 ${added.length}개를 추가했습니다 — 끌어서 위치를 옮기세요`); }
  };

  return (
    <>
      {editable && gridOn && <div className="sticker-grid" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 39, pointerEvents: 'none' }} />}
      <div ref={layerRef} className="sticker-layer" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 0, zIndex: 40, pointerEvents: 'none' }}>
        {stickers.map(s => (
          <Img key={s.id} id={s.id} sticker={s} edit={editable} live={live[s.id]}
            onDown={begin(s.id, 'move')} onResize={begin(s.id, 'size')} onRot={begin(s.id, 'rot')}
            onResetRot={() => onChange(latest.current.map(x => (x.id === s.id ? { ...x, rot: undefined } : x)))}
            onDel={() => onChange(latest.current.filter(x => x.id !== s.id))} />
        ))}
      </div>
      {editable && (
        <div className="sticker-bar" style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 90, display: 'flex', gap: 10, alignItems: 'center', padding: '8px 14px', borderRadius: 12, background: 'rgba(30,32,38,.92)', color: '#fff', fontSize: 12, boxShadow: '0 6px 24px rgba(0,0,0,.3)' }}>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => { void add(e.target.files); e.target.value = ''; }} />
          <button className="btn btn-dark" style={{ height: 30, padding: '0 14px', fontSize: 11.5 }} onClick={() => fileRef.current?.click()}>＋ 스티커 추가</button>
          <span style={{ opacity: .75 }}>끌어서 이동 · ◢ 크기 · ● 기울기 · ✕ 삭제 · Shift = 가운데</span>
        </div>
      )}
    </>
  );
}
