'use client';
// 환경설정 > 휴지통 (B 디자인에서 가져온 기능) — 지운 항목 30일 보관 · 되살리기 · 바로 비우기
import React, { useEffect, useMemo, useState } from 'react';
import { useLocalList } from '@/lib/postStore';
import { syncList } from '@/lib/db';
import { isServerMode } from '@/lib/backend';
import { currentUserId } from '@/lib/currentUser';
import { TRASH_KEY, TRASH_DAYS, COLL_LABEL, isExpired, type TrashEntry } from '@/lib/trash';
import { KSelect } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/Modal';
import { useMembers } from '@/lib/members';

const fmt = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const daysLeft = (iso: string) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

export function TrashPane() {
  const toast = useToast();
  const [list, setList, loaded] = useLocalList<TrashEntry>(TRASH_KEY, []);
  const members = useMembers();
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);
  const [emptyAsk, setEmptyAsk] = useState(false);
  const server = isServerMode();

  // 30일이 지난 것은 들어올 때 정리 (관리자가 이 탭을 열 때)
  useEffect(() => {
    if (!loaded) return;
    const old = list.filter(e => isExpired(e));
    if (old.length) setList(list.filter(e => !isExpired(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const sorted = useMemo(() => [...list].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)), [list]);
  const kinds = useMemo(() => [...new Set(list.map(e => e.coll))], [list]);
  const shown = kind ? sorted.filter(e => e.coll === kind) : sorted;
  const nameOf = (id: string) => members.find(m => m.id === id)?.nickname ?? '';

  const restore = async (e: TrashEntry) => {
    setBusy(true);
    try {
      await syncList(e.coll, [], [e.data], currentUserId());
      setList(list.filter(x => x.id !== e.id));
      toast(`되살렸습니다 — ${COLL_LABEL[e.coll] ?? e.coll}`);
    } catch (err) {
      toast(`되살리지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`);
    }
    setBusy(false);
  };
  const purge = (e: TrashEntry) => setList(list.filter(x => x.id !== e.id));

  return (
    <div className="set-sec">
      <h3>휴지통</h3>
      <div className="d">
        지운 글·그림·캐릭터 등은 {TRASH_DAYS}일 동안 여기에 남습니다 — 「되살리기」를 누르면 원래 자리(목록 맨 앞)로 돌아갑니다.
        {TRASH_DAYS}일이 지난 것은 이 탭을 열 때 자동으로 비워집니다. 백업 복원·데이터 초기화로 지운 것은 들어오지 않습니다.
      </div>
      {!server && <p className="hint">서버(Firebase/Supabase)에 연결된 홈에서만 동작합니다.</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0 12px', flexWrap: 'wrap' }}>
        <KSelect value={kind} onChange={setKind}
          options={[{ value: '', label: `전체 (${list.length})` }, ...kinds.map(k => ({ value: k, label: `${COLL_LABEL[k] ?? k} (${list.filter(e => e.coll === k).length})` }))]} />
        <span style={{ flex: 1 }} />
        {list.length > 0 && <button className="btn btn-ghost" style={{ height: 32 }} onClick={() => setEmptyAsk(true)}>휴지통 비우기</button>}
      </div>
      {loaded && shown.length === 0 && <p className="hint" style={{ padding: '18px 0' }}>휴지통이 비어 있습니다</p>}
      <div className="trash-list">
        {shown.map(e => (
          <div key={e.id} className="trash-row">
            <span className="pill">{COLL_LABEL[e.coll] ?? e.coll}</span>
            <div className="tt">
              <b>{e.title}</b>
              <small>{fmt(e.deletedAt)}{nameOf(e.by) ? ` · ${nameOf(e.by)}` : ''} · {daysLeft(e.deletedAt)}일 남음</small>
            </div>
            <button className="btn btn-dark" style={{ height: 30, padding: '0 14px', fontSize: 11 }} disabled={busy} onClick={() => void restore(e)}>되살리기</button>
            <button className="btn btn-ghost" style={{ height: 30, padding: '0 12px', fontSize: 11 }} disabled={busy} onClick={() => purge(e)}>영구 삭제</button>
          </div>
        ))}
      </div>
      <ConfirmModal open={emptyAsk} title="휴지통 비우기"
        body={kind ? `「${COLL_LABEL[kind] ?? kind}」 항목 ${shown.length}개를 영구 삭제합니다. 되돌릴 수 없습니다.` : `휴지통의 ${list.length}개 항목을 모두 영구 삭제합니다. 되돌릴 수 없습니다.`}
        onClose={() => setEmptyAsk(false)}
        buttons={[
          { label: '영구 삭제', kind: 'dark', onClick: () => { setList(kind ? list.filter(e => e.coll !== kind) : []); setEmptyAsk(false); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setEmptyAsk(false) },
        ]} />
    </div>
  );
}
