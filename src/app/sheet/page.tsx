'use client';
// 시트 게시판 — 구글 스프레드시트 링크 모음 (표 형식)
// With(말머리) · Name(시트 이름) · Check(관리자/회원 2칸) · Url · 말머리 탭으로 모아보기 · With/Name 정렬(기본: 등록 순) · 검색 · 페이지
// 말머리는 환경설정 > 게시판 관리에서 정한다. 항목은 같은 목록(playlog)에 `sheet:` 소속으로 저장된다 (lib/sheetStore.ts)
import { NavLink } from '@/components/ui/NavLink';
import { safeHref } from '@/lib/link';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSectionParam, secQuery } from '@/lib/sectionStore';
import { useLocalList } from '@/lib/postStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { SHEET_KEY, sheetsOf, sheetSetter } from '@/lib/sheetStore';
import { useMenuSettings, canWriteAt, writeKeyOf, writeDefaultOf, SHEET_COLS } from '@/lib/menuStore';
import { useBoardSettings, sheetCatsOf, boardBadgeStyle } from '@/lib/boardStore';
import { SearchBar, Pager } from '@/components/ui/Kit';
import { ConfirmModal } from '@/components/ui/Modal';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';

const PAGE_SIZE = 15;
type SortKey = 'with' | 'name' | null;   // null = 기본(등록한 순서)

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
  const { st: boardSet } = useBoardSettings();
  const cats = sheetCatsOf(boardSet, sec.id);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');                    // '' = ALL (말머리 모아보기)
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [desc, setDesc] = useState(false);               // 정렬 방향
  const [page, setPage] = useState(1);
  const [delFor, setDelFor] = useState<PlayRecord | null>(null);

  // 등록 권한 — 환경설정 「권한」에서 (기본: 관리자) · 수정·삭제는 등록한 본인과 관리자
  const [menuSet] = useMenuSettings();
  const canAdd = canWriteAt(menuSet, writeKeyOf('/sheet', sec.id), { loggedIn: !!user, isAdmin, id: user?.id }, writeDefaultOf('/sheet'));
  const canEdit = (r: PlayRecord) => isAdmin || (!!user && r.authorId === user.id);

  // 표시 열 — 환경설정에서 PC/모바일 각각 선택
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:620px)');
    const f = () => setIsMobile(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const cols = (isMobile ? menuSet.sheetMobile : menuSet.sheetPc ?? []).filter(k => SHEET_COLS.some(c => c.key === k));
  const show = (k: string) => cols.includes(k);

  // 체크 칸 — 왼쪽은 관리자만, 오른쪽은 등록한 회원(과 관리자)만 누를 수 있다
  const canChkAdmin = isAdmin;
  const canChkMember = (r: PlayRecord) => isAdmin || (!!user && r.authorId === user.id);
  const toggle = (r: PlayRecord, f: 'chkAdmin' | 'chkMember') =>
    setRecords(records.map(x => (x.id === r.id ? { ...x, [f]: !x[f] } : x)));

  if (!loaded) return <section className="page" />;

  const curCat = cats.some(c => c.label === cat) ? cat : '';   // 지워져 없어진 말머리면 ALL로
  const query = q.trim().toLowerCase();
  const filtered = records
    .filter(r => !curCat || r.withText.trim() === curCat)
    .filter(r => !query || r.scenario.toLowerCase().includes(query) || r.withText.toLowerCase().includes(query));

  // 정렬 — 기본은 최신 등록순(새 시트가 맨 위) · With는 환경설정의 말머리 순서 · Name은 가나다
  const catIdx = (r: PlayRecord) => { const i = cats.findIndex(c => c.label === r.withText.trim()); return i < 0 ? 9999 : i; };
  const byTime = (a: PlayRecord, b: PlayRecord) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);   // 최신(나중에 등록한) 시트가 위
  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return byTime(a, b);
    const c = sortKey === 'with'
      ? catIdx(a) - catIdx(b) || a.withText.localeCompare(b.withText, 'ko')
      : a.scenario.localeCompare(b.scenario, 'ko');
    return (desc ? -c : c) || byTime(a, b);
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const shown = sorted.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const pickCat = (c: string) => { setCat(c); setPage(1); };
  // 같은 머리글을 누를 때마다: 오름차순 → 내림차순 → 기본(최신 등록순)
  const clickSort = (k: 'with' | 'name') => {
    if (k !== sortKey) { setSortKey(k); setDesc(false); }
    else if (!desc) setDesc(true);
    else { setSortKey(null); setDesc(false); }
    setPage(1);
  };
  const arrow = (k: 'with' | 'name') => (sortKey === k ? (desc ? ' ▾' : ' ▴') : '');
  const catOf = (r: PlayRecord) => cats.find(c => c.label === r.withText.trim());

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>{sec.id === 'main' ? 'SHEETS' : sec.name}</PageTitle>
        <EditableDesc k="sheet-desc" def="구글 스프레드시트 모음 — 말머리별로 모아보기" />
      </div>

      <div className="toolrow">
        {/* 왼쪽: 말머리 모아보기 ALL / 말머리… (많으면 탭째 다음 줄로) */}
        <div className="seg cat-tabs">
          <button className={curCat === '' ? 'on' : ''} onClick={() => pickCat('')}>ALL</button>
          {cats.map(c => (
            <button key={c.id} className={curCat === c.label ? 'on' : ''} onClick={() => pickCat(c.label)}>{c.label}</button>
          ))}
        </div>
        {/* 오른쪽: 검색 · 추가 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBar placeholder="시트 이름·말머리 검색" onSearch={v => { setQ(v); setPage(1); }} />
          {canAdd && <NavLink className="btn btn-dark" href={'/sheet/new' + secQuery('sheet', sec.id)}>＋ ADD SHEET</NavLink>}
        </div>
      </div>

      <div className="panel body-card" style={{ padding: '10px 16px 16px', overflowX: 'auto' }}>
        <table className="pl-table sh-table">
          <colgroup>
            {show('with') && <col className="c-shh" />}
            {show('name') && <col />}
            {show('check') && <col className="c-shc" />}
            {show('url') && <col className="c-shu" />}
            {canAdd && <col className="c-mng" />}
          </colgroup>
          <thead>
            <tr>
              {show('with') && <th className="sortable" onClick={() => clickSort('with')}>With{arrow('with')}</th>}
              {show('name') && <th className="sortable" onClick={() => clickSort('name')}>Name{arrow('name')}</th>}
              {show('check') && <th>Check</th>}
              {show('url') && <th>Url</th>}
              {canAdd && <th aria-label="관리" />}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id}>
                {show('with') && <td>{r.withText.trim() && <span style={boardBadgeStyle(catOf(r))}>{r.withText.trim()}</span>}</td>}
                {show('name') && <td className="td-sc">
                  {r.url
                    ? <a href={safeHref(r.url)} target="_blank" rel="noopener noreferrer">{r.scenario}</a>
                    : r.scenario}
                </td>}
                {show('check') && <td className="td-chk">
                  <button type="button" className={`sh-chk ${r.chkAdmin ? 'on' : ''}`} disabled={!canChkAdmin}
                    aria-label="관리자 확인" aria-pressed={!!r.chkAdmin}
                    onClick={() => toggle(r, 'chkAdmin')} />
                  <button type="button" className={`sh-chk ${r.chkMember ? 'on' : ''}`} disabled={!canChkMember(r)}
                    aria-label="회원 확인" aria-pressed={!!r.chkMember}
                    onClick={() => toggle(r, 'chkMember')} />
                </td>}
                {show('url') && <td className="td-url">
                  {r.url && <a href={safeHref(r.url)} target="_blank" rel="noopener noreferrer" aria-label="시트 열기 (새 탭)"><ClipIcon /></a>}
                </td>}
                {canAdd && (
                  <td className="td-mng">
                    {canEdit(r) && (
                      <>
                        <button onClick={() => router.push(`/sheet/${r.id}/edit`)} data-tip="편집">✎</button>
                        <button onClick={() => setDelFor(r)} data-tip="삭제">✕</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={Math.max(1, cols.length) + (canAdd ? 1 : 0)} style={{ textAlign: 'center', padding: 32, color: 'var(--faint)' }}>
                {query || curCat ? '검색 결과가 없습니다' : '등록된 시트가 없습니다'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
        <Pager page={cur} total={totalPages} onChange={setPage} />
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
