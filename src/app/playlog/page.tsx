'use client';
// TRPG 플레이기록 (4.16) — 표 형식 · Date 정렬 · 검색 · 페이지네이션 ·
// Url 열은 클립 픽토그램(새 탭) · 로그 연결 시 Playtime 클릭으로 로그 이동
import { NavLink } from '@/components/ui/NavLink';
import { safeHref } from '@/lib/link';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSectionParam, filterSection, sectionSetter, secQuery } from '@/lib/sectionStore';
import { useLocalList } from '@/lib/postStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { useMenuSettings, canWriteAt, writeKeyOf, writeDefaultOf, PLAYLOG_COLS } from '@/lib/menuStore';
import { useMainStore } from '@/lib/mainStore';
import { useBoardSettings, playlogCatsOf, boardBadgeStyle } from '@/lib/boardStore';
import { useCardSort, mergeOrder } from '@/lib/cardSort';
import { SearchBar, Pager } from '@/components/ui/Kit';
import { ConfirmModal } from '@/components/ui/Modal';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';

const PAGE_SIZE = 15;
type SortKey = 'with' | 'scenario' | 'writer' | 'playtime' | 'date';

/** "4h 30m" · "4시간 30분" · "90m" · "2:30" 같은 자유 표기를 분으로 — 읽을 수 없으면 null(정렬 때 맨 뒤) */
function playMinutes(t: string): number | null {
  const s = t.trim().toLowerCase();
  if (!s) return null;
  const hm = s.match(/^(\d+):(\d{1,2})$/);
  if (hm) return +hm[1] * 60 + +hm[2];
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|시간)/);
  const m = s.match(/(\d+)\s*(?:m|min|mins|분)/);
  if (h || m) return Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? +m[1] : 0));
  const n = s.match(/^\d+(?:\.\d+)?$/);
  return n ? Math.round(parseFloat(n[0]) * 60) : null;   // 숫자만 쓰면 시간으로 본다
}

/** 클립 픽토그램 (선 아이콘 — 이모지 아님) */
function ClipIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
      <path d="M21 12.5 12.2 21.3a5.6 5.6 0 0 1-8-8L13.5 4a3.7 3.7 0 0 1 5.3 5.3l-9.2 9.2a1.9 1.9 0 0 1-2.7-2.7l8.5-8.4" />
    </svg>
  );
}

function PlaylogPageInner() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [recordsAll, setRecordsAll, loaded] = useLocalList<PlayRecord>('ohome.playlog.v1', PLAYLOG_SEED);
  // 여러 개로 만든 섹션 (v2.0) — 주소의 ?s= 가 가리키는 것만 보여 준다
  const sec = useSectionParam('playlog');
  const records = filterSection(recordsAll, sec.id);
  // 저장은 이 섹션 자리만 교체 — 걸러진 목록을 그대로 넘겨도 다른 섹션이 지워지지 않는다
  const setRecords = sectionSetter(recordsAll, sec.id, setRecordsAll);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');            // '' = ALL (말머리 모아보기 — 환경설정 > 게시판 관리에서 정한 With 말머리)
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [desc, setDesc] = useState(true);           // 정렬 방향 (Date는 최신이 위)
  const { st: boardSet } = useBoardSettings();
  const cats = playlogCatsOf(boardSet, sec.id);
  const [page, setPage] = useState(1);
  const [delFor, setDelFor] = useState<PlayRecord | null>(null);

  // 표시 열 — 환경설정 > 메뉴 관리에서 PC/모바일 각각 선택 (4.16 v1.8)
  const [menuSet] = useMenuSettings();
  // 등록 권한 (v2.1) — 환경설정 「권한」에서 (기본: 관리자) · 수정·삭제는 등록한 본인과 관리자
  const canAdd = canWriteAt(menuSet, writeKeyOf('/playlog', sec.id), { loggedIn: !!user, isAdmin, id: user?.id }, writeDefaultOf('/playlog'));
  const canEdit = (r: PlayRecord) => isAdmin || (!!user && r.authorId === user.id);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:620px)');
    const f = () => setIsMobile(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  // 지금 있는 열만 — 예전에 저장한 열 목록에는 v2.1에서 없앤 Role이 남아 있을 수 있다. 그대로 세면 빈 목록 안내 칸이 실제 열보다
  // 넓게 합쳐져 표에 보이지 않는 열이 하나 더 생기고, 머리줄 밑선이 중간에서 끊겨 보였다 (v2.1 사용자 제보: 기록이 없을 때 모양)
  const cols = (isMobile ? menuSet.playlogMobile : menuSet.playlogPc).filter(k => PLAYLOG_COLS.some(c => c.key === k));
  const show = (k: string) => cols.includes(k);

  // 편집모드 행 드래그 정렬 (v1.9) — 편집 중에는 정렬·페이지 없이 저장 순서 전체 표시
  const { editOn } = useMainStore();
  const rowSort = useCardSort(records, next => setRecords(mergeOrder(records, next)), editOn && isAdmin);

  if (!loaded) return <section className="page" />;

  const query = q.trim().toLowerCase();
  const curCat = cats.some(c => c.label === cat) ? cat : '';   // 지워져 없어진 말머리면 ALL로
  const filtered = records
    .filter(r => !curCat || r.withText.trim() === curCat)
    .filter(r => !query
      || r.scenario.toLowerCase().includes(query)
      || r.writer.toLowerCase().includes(query)
      || r.withText.toLowerCase().includes(query));

  // 정렬 — Date는 날짜 없는 기록이 항상 맨 아래 · With는 환경설정에서 정한 말머리 순서 · Scenario/Writer는 가나다
  const catIdx = (r: PlayRecord) => { const i = cats.findIndex(c => c.label === r.withText.trim()); return i < 0 ? 9999 : i; };
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'date') {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return desc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    }
    const c = sortKey === 'with' ? catIdx(a) - catIdx(b) || a.withText.localeCompare(b.withText, 'ko')
      : sortKey === 'scenario' ? a.scenario.localeCompare(b.scenario, 'ko')
      : sortKey === 'playtime' ? 0
      : a.writer.localeCompare(b.writer, 'ko');
    if (sortKey === 'playtime') {
      const x = playMinutes(a.playtime), y = playMinutes(b.playtime);
      if (x === null && y === null) return a.playtime.localeCompare(b.playtime, 'ko');
      if (x === null) return 1;      // 읽을 수 없는 값은 방향과 상관없이 맨 아래
      if (y === null) return -1;
      return desc ? y - x : x - y;
    }
    return desc ? -c : c;
  });
  const clickSort = (k: SortKey) => {
    if (editOn) return;
    if (k === sortKey) setDesc(d => !d);
    else { setSortKey(k); setDesc(k === 'date'); }   // 날짜는 최신순부터, 글자는 가나다순부터
    setPage(1);
  };
  const arrow = (k: SortKey) => (editOn ? (k === 'date' ? ' ⠿' : '') : sortKey === k ? (desc ? ' ▾' : ' ▴') : '');
  const pickCat = (c: string) => { setCat(c); setPage(1); };
  const catOf = (r: PlayRecord) => cats.find(c => c.label === r.withText.trim());
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // 편집모드: 저장 순서 전체 표시 (드래그 인덱스와 1:1 매칭)
  const curPage = Math.min(page, totalPages);
  const shown = editOn ? records : sorted.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  // 모바일 전용 — URL 열이 없으므로 Playtime 밑줄 탭으로 로그 이동 (4.16)
  const openLogMobile = (r: PlayRecord) => {
    if (r.logId && window.matchMedia('(max-width:620px)').matches) router.push(`/trpg/${r.logId}`);
  };

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>{sec.id === 'main' ? 'PLAY LOG' : sec.name}</PageTitle>
        <EditableDesc k="playlog-desc" def="다녀온 세션 기록 — 표 형식" />
      </div>

      <div className="toolrow">
        {/* 왼쪽: 말머리 모아보기 ALL / 말머리… (시트 게시판과 같다 — 많으면 탭째 다음 줄로) */}
        <div className="seg cat-tabs">
          <button className={curCat === '' ? 'on' : ''} onClick={() => pickCat('')}>ALL</button>
          {cats.map(c => (
            <button key={c.id} className={curCat === c.label ? 'on' : ''} onClick={() => pickCat(c.label)}>{c.label}</button>
          ))}
        </div>
        {/* 오른쪽: 검색 · 추가 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBar placeholder="시나리오·라이터·With 검색" onSearch={v => { setQ(v); setPage(1); }} />
          {canAdd && <NavLink className="btn btn-dark" href={'/playlog/new' + secQuery('playlog', sec.id)}>＋ ADD RECORD</NavLink>}
        </div>
      </div>

      <div className="panel body-card" style={{ padding: '10px 16px 16px', overflowX: 'auto' }}>
        <table className="pl-table">
          {/* 열 구성 — 환경설정 > 메뉴 관리에서 PC/모바일 각각 선택 (4.16 v1.8) */}
          <colgroup>
            {show('with') && <col className="c-with" />}
            {show('scenario') && <col className="c-sc" />}
            {show('writer') && <col className="c-wr" />}
            {show('date') && <col className="c-date" />}
            {show('playtime') && <col className="c-pt" />}
            {show('url') && <col className="c-url" />}
            {canAdd && !isMobile && <col className="c-mng" />}
          </colgroup>
          <thead>
            <tr>
              {show('with') && <th className="sortable" onClick={() => clickSort('with')}>With{arrow('with')}</th>}
              {show('scenario') && <th className="sortable" onClick={() => clickSort('scenario')}>Scenario{arrow('scenario')}</th>}
              {show('writer') && <th className="sortable" onClick={() => clickSort('writer')}>Writer{arrow('writer')}</th>}
              {show('date') && <th className="sortable" onClick={() => clickSort('date')}>Date{arrow('date')}</th>}
              {show('playtime') && <th className="sortable" onClick={() => clickSort('playtime')}>Playtime{arrow('playtime')}</th>}
              {show('url') && <th aria-label="Url" />}
              {canAdd && !isMobile && <th aria-label="관리" />}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id} {...(editOn ? rowSort(i) : {})}>
                {show('with') && <td>{r.withText.trim() && <span style={boardBadgeStyle(catOf(r))}>{r.withText.trim()}</span>}</td>}
                {show('scenario') && (
                  <td className="td-sc">
                    {r.scenarioLink
                      ? <a href={r.scenarioLink} target="_blank" rel="noopener noreferrer">{r.scenario}</a>
                      : r.scenario}
                  </td>
                )}
                {show('writer') && <td>{r.writer}</td>}
                {show('date') && <td className="td-date">{r.date ? r.date.replace(/-/g, '.') : ''}</td>}
                {show('playtime') && (
                  <td className={`td-pt ${r.logId ? 'linked' : ''}`}
                    onClick={() => openLogMobile(r)}>
                    {r.playtime}
                  </td>
                )}
                {/* 클립 칸 — 외부 URL 또는 백업 로그 연결 (4.16) */}
                {show('url') && (
                  <td className="td-url">
                    {r.url ? (
                      <a href={safeHref(r.url)} target="_blank" rel="noopener noreferrer" data-tip="링크 열기 (새 탭)"><ClipIcon /></a>
                    ) : r.logId ? (
                      <NavLink data-tip="백업 로그 보기" style={{ cursor: 'var(--cur-pointer,pointer)' }}
                        href={`/trpg/${r.logId}`}><ClipIcon /></NavLink>
                    ) : null}
                  </td>
                )}
                {canAdd && !isMobile && (
                  <td className="td-mng">
                    {canEdit(r) && (
                      <>
                        <button onClick={() => router.push(`/playlog/${r.id}/edit`)} data-tip="편집">✎</button>
                        <button onClick={() => setDelFor(r)} data-tip="삭제">✕</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={cols.length + (canAdd && !isMobile ? 1 : 0)} style={{ textAlign: 'center', padding: 32, color: 'var(--faint)' }}>
                {query || curCat ? '검색 결과가 없습니다' : '기록이 없습니다'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
        {!editOn && <Pager page={curPage} total={totalPages} onChange={setPage} />}
      </div>

      <ConfirmModal open={delFor !== null} title="기록을 삭제하시겠습니까?"
        body={`"${delFor?.scenario}" — 삭제하면 복구할 수 없습니다.`}
        onClose={() => setDelFor(null)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => { setRecords(records.filter(x => x.id !== delFor!.id)); setDelFor(null); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelFor(null) },
        ]} />
    </section>
  );
}

/** ?s= 를 읽으므로 Suspense 경계가 필요하다 (Next App Router) */
export default function PlaylogPage() {
  return <Suspense fallback={<section className="page" />}><PlaylogPageInner /></Suspense>;
}
