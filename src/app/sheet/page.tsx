'use client';
// 시트 게시판 — 구글 스프레드시트 링크 모음 (표 형식)
// With(말머리) · Name(시트 이름) · Date · Url(시트 링크) · 말머리 탭/칩으로 모아보기 · Date 정렬 · 검색 · 페이지
// 플레이기록(/playlog)의 표를 바탕으로 했고, 항목은 같은 목록(playlog)에 `sheet:` 소속으로 저장된다 (lib/sheetStore.ts)
import React, { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSectionParam, secQuery } from '@/lib/sectionStore';
import { useLocalList } from '@/lib/postStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { SHEET_KEY, sheetsOf, sheetSetter } from '@/lib/sheetStore';
import { useMenuSettings, canWriteAt, writeKeyOf, writeDefaultOf } from '@/lib/menuStore';
import { useMainStore } from '@/lib/mainStore';
import { useCardSort, mergeOrder } from '@/lib/cardSort';
import { SearchBar, Pager } from '@/components/ui/Kit';
import { ConfirmModal } from '@/components/ui/Modal';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';

const PAGE_SIZE = 15;

/** 클립 픽토그램 (선 아이콘 — 이모지 아님) */
function ClipIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
      <path d="M21 12.5 12.2 21.3a5.6 5.6 0 0 1-8-8L13.5 4a3.7 3.7 0 0 1 5.3 5.3l-9.2 9.2a1.9 1.9 0 0 1-2.7-2.7l8.5-8.4" />
    </svg>
  );
}

function SheetPageInner() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [allRecs, setAllRecs, loaded] = useLocalList<PlayRecord>(SHEET_KEY, PLAYLOG_SEED);
  // 여러 개로 만든 섹션 — 주소의 ?s= 가 가리키는 것만 보여 준다
  const sec = useSectionParam('sheet');
  const records = sheetsOf(allRecs, sec.id);
  // 저장은 이 섹션 자리만 교체 — 플레이기록·다른 섹션 항목은 그대로
  const setRecords = sheetSetter(allRecs, sec.id, setAllRecs);

  const [q, setQ] = useState('');
  const [head, setHead] = useState('');          // '' = ALL (말머리 모아보기)
  const [desc, setDesc] = useState(true);        // Date 정렬 방향
  const [page, setPage] = useState(1);
  const [delFor, setDelFor] = useState<PlayRecord | null>(null);

  // 등록 권한 — 환경설정 「권한」에서 (기본: 관리자) · 수정·삭제는 등록한 본인과 관리자
  const [menuSet] = useMenuSettings();
  const canAdd = canWriteAt(menuSet, writeKeyOf('/sheet', sec.id), { loggedIn: !!user, isAdmin, id: user?.id }, writeDefaultOf('/sheet'));
  const canEdit = (r: PlayRecord) => isAdmin || (!!user && r.authorId === user.id);

  // 편집모드 행 드래그 정렬 — 편집 중에는 정렬·페이지 없이 저장 순서 전체 표시
  const { editOn } = useMainStore();
  const rowSort = useCardSort(records, next => setRecords(mergeOrder(records, next)), editOn && isAdmin);

  if (!loaded) return <section className="page" />;

  // 말머리 탭 — 이 섹션에 쓰인 말머리를 처음 나온 순서대로 (개수 포함)
  const headList = [...new Set(records.map(r => r.withText.trim()).filter(Boolean))];
  const countOf = (h: string) => records.filter(r => r.withText.trim() === h).length;
  const curHead = headList.includes(head) ? head : '';   // 지워져 없어진 말머리면 ALL로

  const query = q.trim().toLowerCase();
  const filtered = records
    .filter(r => !curHead || r.withText.trim() === curHead)
    .filter(r => !query || r.scenario.toLowerCase().includes(query) || r.withText.toLowerCase().includes(query));

  // Date 정렬 — 날짜 없는 기록은 항상 맨 아래
  const sorted = [...filtered].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return desc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const shown = editOn ? records : sorted.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const pickHead = (h: string) => { setHead(h); setPage(1); };
  const editHref = (r: PlayRecord) => `/sheet/${r.id}/edit`;

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>{sec.id === 'main' ? 'SHEETS' : sec.name}</PageTitle>
        <EditableDesc k="sheet-desc" def="구글 스프레드시트 모음 — 말머리별로 모아보기" />
        <div className="head-actions">
          <SearchBar placeholder="시트 이름·말머리 검색" onSearch={v => { setQ(v); setPage(1); }} />
          {canAdd && <button className="btn btn-dark" onClick={() => router.push('/sheet/new' + secQuery('sheet', sec.id))}>＋ ADD SHEET</button>}
        </div>
      </div>

      {/* 말머리 모아보기 — ALL / 말머리… (많으면 다음 줄로) */}
      {headList.length > 0 && (
        <div className="toolrow">
          <div className="seg cat-tabs">
            <button className={curHead === '' ? 'on' : ''} onClick={() => pickHead('')}>ALL</button>
            {headList.map(h => (
              <button key={h} className={curHead === h ? 'on' : ''} onClick={() => pickHead(h)}>{h} <small style={{ opacity: .6 }}>{countOf(h)}</small></button>
            ))}
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: '10px 16px 16px', overflowX: 'auto' }}>
        <table className="pl-table sh-table">
          <colgroup>
            <col className="c-shh" />
            <col />
            <col className="c-shd" />
            <col className="c-shu" />
            {canAdd && <col className="c-mng" />}
          </colgroup>
          <thead>
            <tr>
              <th>With</th>
              <th>Name</th>
              <th className="sortable" onClick={() => { if (!editOn) setDesc(d => !d); }}>
                Date {editOn ? '⠿' : desc ? '▾' : '▴'}
              </th>
              <th aria-label="Url" />
              {canAdd && <th aria-label="관리" />}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id} {...(editOn ? rowSort(i) : {})}>
                <td>
                  {r.withText.trim() && (
                    <button type="button" className={`sh-chip ${curHead === r.withText.trim() ? 'on' : ''}`}
                      data-tip="이 말머리만 모아보기"
                      onClick={() => pickHead(curHead === r.withText.trim() ? '' : r.withText.trim())}>{r.withText.trim()}</button>
                  )}
                </td>
                <td className="td-sc">
                  {r.url
                    ? <a href={r.url} target="_blank" rel="noreferrer" data-tip="시트 열기 (새 탭)">{r.scenario}</a>
                    : r.scenario}
                </td>
                <td className="td-date">{r.date ? r.date.replace(/-/g, '.') : ''}</td>
                <td className="td-url">
                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" data-tip="시트 열기 (새 탭)"><ClipIcon /></a>}
                </td>
                {canAdd && (
                  <td className="td-mng">
                    {canEdit(r) && (
                      <>
                        <button onClick={() => router.push(editHref(r))} data-tip="편집">✎</button>
                        <button onClick={() => setDelFor(r)} data-tip="삭제">✕</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={4 + (canAdd ? 1 : 0)} style={{ textAlign: 'center', padding: 32, color: 'var(--faint)' }}>
                {query || curHead ? '검색 결과가 없습니다' : '등록된 시트가 없습니다'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
        {!editOn && <Pager page={cur} total={totalPages} onChange={setPage} />}
      </div>

      <ConfirmModal open={delFor !== null} title="시트를 삭제하시겠습니까?"
        body={`"${delFor?.scenario}" — 목록에서만 지워지며, 구글 스프레드시트 원본은 그대로입니다.`}
        onClose={() => setDelFor(null)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => { setRecords(records.filter(x => x.id !== delFor!.id)); setDelFor(null); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelFor(null) },
        ]} />
    </section>
  );
}

/** ?s= 를 읽으므로 Suspense 경계가 필요하다 (Next App Router) */
export default function SheetPage() {
  return <Suspense fallback={<section className="page" />}><SheetPageInner /></Suspense>;
}
