'use client';
// 말머리 고르기 — 환경설정 > 게시판 관리에서 정해 둔 말머리를 눌러 고른다 (다시 누르면 해제).
// 정해 둔 말머리에 없는 옛 값(예전에 직접 적은 글)은 그대로 보이게 따로 한 칸 더 보여 준다.
import React from 'react';
import { BoardBadge, boardBadgeStyle } from '@/lib/boardStore';

export function CatPick({ cats, value, onChange }: { cats: BoardBadge[]; value: string; onChange: (v: string) => void }) {
  const v = value.trim();
  const legacy = v && !cats.some(c => c.label === v) ? v : '';
  if (cats.length === 0 && !legacy) {
    return <p className="hint" style={{ margin: 0 }}>정해 둔 말머리가 없습니다 — 환경설정 &gt; 게시판 관리에서 말머리를 추가하세요 (없어도 등록할 수 있습니다)</p>;
  }
  const chip = (label: string, b?: BoardBadge) => {
    const on = v === label;
    return (
      <button key={label} type="button" onClick={() => onChange(on ? '' : label)}
        style={{ ...boardBadgeStyle(b), cursor: 'var(--cur-pointer,pointer)', opacity: on ? 1 : .5, outline: on ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}>
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {cats.map(c => chip(c.label, c))}
      {legacy && chip(legacy)}
    </div>
  );
}
