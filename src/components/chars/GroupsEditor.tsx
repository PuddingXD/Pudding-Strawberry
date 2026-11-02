'use client';
// 항목 그룹 편집 — 기본 정보와 추가 탭이 같이 쓴다.
// 그룹 추가/삭제, 항목 추가/삭제, ⠿ 핸들을 잡아 끌면 같은 그룹 안에서도, 다른 그룹으로도 옮길 수 있다.
import React, { useRef, useState } from 'react';
import { TabGroup } from '@/lib/charStore';
import { newId } from '@/lib/postStore';
import { KInput } from '@/components/ui/Kit';

type Target = { gid: string; index: number };

export function GroupsEditor({ groups, onChange, defaults }: {
  groups: TabGroup[];
  onChange: (g: TabGroup[]) => void;
  defaults?: () => TabGroup[];   // 그룹이 하나도 없을 때 「기본 항목 넣기」로 채울 값
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ iid: string; target: Target | null } | null>(null);
  const setGroup = (id: string, items: TabGroup['items']) => onChange(groups.map(x => (x.id === id ? { ...x, items } : x)));

  /** 포인터 위치 → 놓일 그룹과 자리 (끄는 항목 자신은 빼고 센다) */
  const targetAt = (x: number, y: number, iid: string): Target | null => {
    const boxes = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-gid]') ?? []);
    if (boxes.length === 0) return null;
    let best = boxes[0], bestD = Infinity;
    for (const b of boxes) {
      const r = b.getBoundingClientRect();
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d < bestD) { best = b; bestD = d; }
    }
    const rows = Array.from(best.querySelectorAll<HTMLElement>('[data-iid]')).filter(r => r.dataset.iid !== iid);
    let index = 0;
    for (const r of rows) { const rr = r.getBoundingClientRect(); if (y > rr.top + rr.height / 2) index++; }
    void x;
    return { gid: best.dataset.gid!, index };
  };

  const startDrag = (e: React.PointerEvent, iid: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag({ iid, target: null });
    const mv = (ev: PointerEvent) => setDrag(d => (d ? { ...d, target: targetAt(ev.clientX, ev.clientY, iid) } : d));
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const t = targetAt(ev.clientX, ev.clientY, iid);
      setDrag(null);
      if (!t) return;
      onChange(((cur: TabGroup[]) => {
        const item = cur.flatMap(g => g.items).find(x => x.id === iid);
        if (!item) return cur;
        const removed = cur.map(g => ({ ...g, items: g.items.filter(x => x.id !== iid) }));
        return removed.map(g => {
          if (g.id !== t.gid) return g;
          const items = [...g.items];
          items.splice(Math.min(t.index, items.length), 0, item);
          return { ...g, items };
        });
      })(groupsRef.current));
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  // 놓는 순간의 최신 groups를 쓰기 위해
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  return (
    <div ref={rootRef} style={{ display: 'grid', gap: 12 }}>
      {groups.map((g, gi) => {
        const line = (i: number) => (drag?.target?.gid === g.id && drag.target.index === i
          ? <div key={`ln${i}`} style={{ height: 3, borderRadius: 2, background: 'var(--accent)', margin: '1px 0' }} /> : null);
        const rows = g.items.filter(x => x.id !== drag?.iid);   // 끄는 중인 항목은 자리를 비운다(줄이 놓일 자리를 보여 줌)
        return (
          <div key={g.id} data-gid={g.id} style={{ border: '1.5px solid var(--line)', borderRadius: 8, padding: '8px 10px', display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>그룹 {gi + 1}</small>
              <span className="fx" style={{ marginLeft: 'auto' }} data-tip="그룹 삭제"
                onClick={() => onChange(groups.filter(x => x.id !== g.id))}>✕</span>
            </div>
            <div>
              {g.items.map(x => {
                const idx = rows.findIndex(r => r.id === x.id);
                const dragging = drag?.iid === x.id;
                return (
                  <React.Fragment key={x.id}>
                    {!dragging && line(idx)}
                    <div data-iid={x.id} style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', padding: '2px 0', opacity: dragging ? 0.35 : 1 }}>
                      <span className="drag-h" style={{ touchAction: 'none' }} data-tip="끌어서 순서·그룹 이동"
                        onPointerDown={e => startDrag(e, x.id)}>⠿</span>
                      <KInput placeholder="항목" value={x.label} style={{ fontSize: 12, padding: '7px 10px', width: 90 }}
                        onChange={e => setGroup(g.id, g.items.map(y => (y.id === x.id ? { ...y, label: e.target.value } : y)))} />
                      <KInput placeholder="값" value={x.value} style={{ fontSize: 12, padding: '7px 10px' }}
                        onChange={e => setGroup(g.id, g.items.map(y => (y.id === x.id ? { ...y, value: e.target.value } : y)))} />
                      <span className="fx" onClick={() => setGroup(g.id, g.items.filter(y => y.id !== x.id))}>✕</span>
                    </div>
                  </React.Fragment>
                );
              })}
              {line(rows.length)}
            </div>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11, justifySelf: 'center' }}
              onClick={() => setGroup(g.id, [...g.items, { id: newId(), label: '', value: '' }])}>＋ 항목</button>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => onChange([...groups, { id: newId(), items: [{ id: newId(), label: '', value: '' }] }])}>＋ 그룹 추가</button>
        {groups.length === 0 && defaults && (
          <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
            onClick={() => onChange(defaults())}>기본 항목 넣기</button>
        )}
      </div>
    </div>
  );
}
