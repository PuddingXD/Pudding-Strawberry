'use client';
// 게시판 말머리 관리 (사용자 요청 — 「썰·러닝·티켓형 게시판 말머리를 고칠 곳을 못 찾겠다」).
// 게시판 목록 화면에서 바로 그 게시판의 말머리를 추가·이름 수정·색·순서·삭제한다 (관리자).
// 환경설정 › 게시판 관리 › 말머리와 같은 자료(게시판별 cats)를 고친다.
import React from 'react';
import { Modal, useConfirmDelete } from '@/components/ui/Modal';
import { DragList } from '@/components/ui/DragList';
import { KInput } from '@/components/ui/Kit';
import { ColorField } from '@/components/ui/ColorField';
import { boardBadgeStyle, type Board, type BoardBadge } from '@/lib/boardStore';
import { newId } from '@/lib/postStore';

export function BoardCatsModal({ board, onChange, onClose }: {
  board: Board; onChange: (cats: BoardBadge[]) => void; onClose: () => void;
}) {
  const del = useConfirmDelete();
  const cats = board.cats;
  const patch = (id: string, p: Partial<BoardBadge>) => onChange(cats.map(c => (c.id === id ? { ...c, ...p } : c)));
  return (
    <Modal open onClose={onClose} title={`말머리 관리 — ${board.name}`}
      desc="⠿ 끌어서 순서 · 이름과 색 수정 · 추가/삭제 — 바꾸면 바로 저장돼요. 이름을 바꿔도 이미 쓴 글은 예전 이름으로 남아요"
      actions={<button className="btn btn-dark" onClick={onClose}>DONE</button>}>
      <DragList items={cats} keyOf={c => c.id} onReorder={onChange}
        render={c => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', flexWrap: 'wrap', padding: '4px 0' }}>
            <span className="drag-h">⠿</span>
            <span style={{ ...boardBadgeStyle(c), minWidth: 54, textAlign: 'center' }}>{c.label || '말머리'}</span>
            <KInput value={c.label} onChange={e => patch(c.id, { label: e.target.value })} style={{ width: 110 }} />
            <span className="cp-lb">배경</span>
            <ColorField value={c.bg} onChange={hex => patch(c.id, { bg: hex })} />
            <span className="cp-lb">글씨</span>
            <ColorField value={c.fg} onChange={hex => patch(c.id, { fg: hex })} />
            <span className="cp-lb">테두리</span>
            <ColorField value={c.border} onChange={hex => patch(c.id, { border: hex })} />
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5, marginLeft: 'auto' }}
              onClick={() => del.ask(`말머리 「${c.label}」를 삭제하시겠습니까?`, () => onChange(cats.filter(x => x.id !== c.id)),
                '이 말머리로 쓴 글은 그대로 남고 중립색 뱃지로 보여요.')}>삭제</button>
          </div>
        )} />
      {cats.length === 0 && <p className="hint" style={{ margin: '4px 0 0' }}>말머리가 없어요 — 아래에서 추가해 주세요</p>}
      <div style={{ marginTop: 10 }}>
        <button className="btn btn-ghost" style={{ height: 30, fontSize: 11 }}
          onClick={() => onChange([...cats, { id: newId(), label: '새 말머리', bg: '#eef0f2', border: '#d7dae0', fg: '#5d636d' }])}>＋ 말머리 추가</button>
      </div>
      {del.element}
    </Modal>
  );
}
