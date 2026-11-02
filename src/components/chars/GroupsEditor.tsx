'use client';
// 항목 그룹 편집 — 기본 정보와 추가 탭이 같이 쓴다. 그룹 추가/삭제, 항목 추가/삭제, ⠿ 드래그로 순서 변경.
import React from 'react';
import { TabGroup } from '@/lib/charStore';
import { newId } from '@/lib/postStore';
import { KInput } from '@/components/ui/Kit';
import { DragList } from '@/components/ui/DragList';

export function GroupsEditor({ groups, onChange, defaults }: {
  groups: TabGroup[];
  onChange: (g: TabGroup[]) => void;
  defaults?: () => TabGroup[];   // 그룹이 하나도 없을 때 「기본 항목 넣기」로 채울 값
}) {
  const setGroup = (id: string, items: TabGroup['items']) => onChange(groups.map(x => (x.id === id ? { ...x, items } : x)));
  return (
    <>
      {groups.map((g, gi) => (
        <div key={g.id} style={{ border: '1.5px solid var(--line)', borderRadius: 8, padding: '8px 10px', display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>그룹 {gi + 1}</small>
            <span className="fx" style={{ marginLeft: 'auto' }} data-tip="그룹 삭제"
              onClick={() => onChange(groups.filter(x => x.id !== g.id))}>✕</span>
          </div>
          <DragList items={g.items} keyOf={x => x.id} onReorder={items => setGroup(g.id, items)}
            render={x => (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', padding: '2px 0' }}>
                <span className="drag-h">⠿</span>
                <KInput placeholder="항목" value={x.label} style={{ fontSize: 12, padding: '7px 10px', width: 90 }}
                  onChange={e => setGroup(g.id, g.items.map(y => (y.id === x.id ? { ...y, label: e.target.value } : y)))} />
                <KInput placeholder="값" value={x.value} style={{ fontSize: 12, padding: '7px 10px' }}
                  onChange={e => setGroup(g.id, g.items.map(y => (y.id === x.id ? { ...y, value: e.target.value } : y)))} />
                <span className="fx" onClick={() => setGroup(g.id, g.items.filter(y => y.id !== x.id))}>✕</span>
              </div>
            )} />
          <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11, justifySelf: 'center' }}
            onClick={() => setGroup(g.id, [...g.items, { id: newId(), label: '', value: '' }])}>＋ 항목</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => onChange([...groups, { id: newId(), items: [{ id: newId(), label: '', value: '' }] }])}>＋ 그룹 추가</button>
        {groups.length === 0 && defaults && (
          <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
            onClick={() => onChange(defaults())}>기본 항목 넣기</button>
        )}
      </div>
    </>
  );
}
