'use client';
// 일반 게시판 목록 (4.2 / 5.2 다중 게시판) — 말머리 필터 · 검색 · 비밀글 마스킹 · 접기 표시 · 페이지네이션
// ?b=<게시판 id> 로 게시판 구분 (없으면 기본 게시판) · 리스트 스킨: 기본형 / 티켓형 (5.2 v1.9)
import React, { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  useLocalList, BOARD_SEED, Post, fmtDate, isPublished, pubLabel,
  CommentRow, COMMENT_KEY, COMMENT_SEED, commentsFor,
} from '@/lib/postStore';
import {
  useBoardSettings, useBoards, perPageOf, badgeFor, boardBadgeStyle, boardHref, MAIN_BOARD_ID,
} from '@/lib/boardStore';
import { useMenuSettings, canWriteAt, canReadSecret } from '@/lib/menuStore';
import { LockIcon } from '@/components/ui/LockIcon';
import { SearchBar, Pager } from '@/components/ui/Kit';
import { CropImg } from '@/components/ui/CropEditor';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { talkCount } from '@/components/board/TalkView';
import { BoardCatsModal } from '@/components/board/BoardCatsModal';


/** 본문에서 첫 이미지 추출 — 티켓 스킨 썸네일용 (HTML img / MD 이미지) */
function firstImage(body: string): string | null {
  const html = /<img[^>]*src=["']([^"']+)["']/i.exec(body);
  if (html) return html[1];
  const md = /!\[[^\]]*\]\(([^)\s]+)/.exec(body);
  return md ? md[1] : null;
}

function BoardInner() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const params = useSearchParams();
  const bid = params.get('b') ?? MAIN_BOARD_ID;
  const runCat = params.get('c');   // 러닝 스킨 — 고른 말머리 (없으면 말머리 고르는 첫 화면)
  const { boards, loaded: boardsLoaded, patchBoard } = useBoards();
  const [catsOpen, setCatsOpen] = useState(false);   // 말머리 관리 (관리자, 사용자 요청)
  const board = boards.find(b => b.id === bid) ?? boards[0];
  const [menuSet] = useMenuSettings();
  const [posts] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  // 댓글 수 — 댓글은 글과 따로 저장된다 (v2.0). 옛 글 안에 남아 있던 것도 함께 센다
  const [cmtRows] = useLocalList<CommentRow>(COMMENT_KEY, COMMENT_SEED);
  const cmtCount = (p: Post) => commentsFor(cmtRows, 'post', p.id, p.comments).length;
  const { st: boardSet } = useBoardSettings();   // 말머리 뱃지 색 (환경설정 > 게시판 관리)
  const [cat, setCat] = useState('전체');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  // 게시판 전환 시 필터·페이지 초기화
  const [prevBid, setPrevBid] = useState(bid);
  if (prevBid !== bid) { setPrevBid(bid); setCat('전체'); setQ(''); setPage(1); }

  const visible = useMemo(() => {
    let list = posts.filter(p => (p.boardId ?? MAIN_BOARD_ID) === board.id);
    // 예약 공개·임시 저장 (B 디자인) — 공개 전 글은 작성자·관리자만 본다
    list = list.filter(p => isPublished(p) || isAdmin || (!!p.authorId && p.authorId === user?.id));
    if (board.skin === 'running' && runCat) list = list.filter(p => p.category === runCat);
    if (cat === '공지') list = list.filter(p => p.notice);
    else if (cat !== '전체') list = list.filter(p => p.category === cat);
    if (q) {
      const k = q.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(k) ||
        p.author.toLowerCase().includes(k) ||
        (p.tags ?? []).some(t => t.toLowerCase().includes(k)) ||   // 태그 검색 (v2.0 사용자 요청)
        (!p.secret && !p.pwLock && p.body.toLowerCase().includes(k)));
    }
    // 공지 상단 고정 + 최신순
    return list.sort((a, b) =>
      (b.notice ? 1 : 0) - (a.notice ? 1 : 0) || b.date.localeCompare(a.date));
  }, [posts, board.id, board.skin, runCat, cat, q, isAdmin, user?.id]);

  const PER_PAGE = perPageOf(boardSet, 'board');   // 한 페이지에 몇 개 — 환경설정 > 게시판 관리 (기본 8)
  const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const pageList = visible.slice((Math.min(page, totalPages) - 1) * PER_PAGE, Math.min(page, totalPages) * PER_PAGE);
  /* 비밀글 열람 (v2.0 발견) — authorId 없는 비밀글은 비로그인 방문자에게도 열렸다.
     둘 다 undefined라 `undefined === undefined`가 참이었기 때문 */
  // 비밀글은 관리자 · 글쓴이 · 권한 탭에서 지정한 회원만 (게시판마다)
  const canRead = (p: Post) => !p.secret || canReadSecret(menuSet, boardHref(board.id), p, { isAdmin, id: user?.id });

  if (!boardsLoaded) return <section className="page" />;

  const postBadge = (p: Post) => (
    <span style={boardBadgeStyle(badgeFor(boardSet, p, board.cats))}>{p.category}</span>
  );
  // 공개 전 표시 (예약·임시 저장) — 작성자·관리자에게만 목록에 보이는 글
  const pubTag = (p: Post) => (pubLabel(p) ? <span className="pub-tag">{pubLabel(p)}</span> : null);
  const locked = (p: Post) => !!p.pwLock;   // 비밀번호 글 — 제목은 보이고 들어가면 비밀번호를 묻는다
  const go = (p: Post) => { if (canRead(p)) router.push(`/board/${p.id}`); };
  const runHref = (c?: string) => `${boardHref(board.id)}${board.id === MAIN_BOARD_ID ? '?' : '&'}${c ? `c=${encodeURIComponent(c)}` : ''}`.replace(/[?&]$/, '');
  // 러닝 첫 화면 카드 — 말머리마다 그 말머리 최신 글의 대표 이미지
  const runCover = (c: string) => {
    const p = posts.filter(x => (x.boardId ?? MAIN_BOARD_ID) === board.id && x.category === c && isPublished(x) && !x.secret && !x.pwLock)
      .sort((a, b) => b.date.localeCompare(a.date)).find(x => x.thumbSrc ?? firstImage(x.body));
    return p ? { src: (p.thumbSrc ?? firstImage(p.body))!, crop: p.thumbSrc ? p.thumbCrop : undefined } : null;
  };
  const runCount = (c: string) => posts.filter(x => (x.boardId ?? MAIN_BOARD_ID) === board.id && x.category === c
    && (isPublished(x) || isAdmin || (!!x.authorId && x.authorId === user?.id))).length;

  return (
    <section className="page">
      {catsOpen && <BoardCatsModal board={board} onChange={cats => patchBoard(board.id, { cats })} onClose={() => setCatsOpen(false)} />}
      <div className="page-head">
        <PageTitle href={boardHref(board.id)}>{board.id === MAIN_BOARD_ID ? 'BOARD' : board.name}</PageTitle>
        <EditableDesc k={board.id === MAIN_BOARD_ID ? 'board-desc' : `board-desc-${board.id}`} def={board.desc} />
      </div>
      <div className="toolrow">
        {/* 말머리 탭 — 많으면 탭째 다음 줄로 (cat-tabs, 루넬갠홈에서 이식) */}
        {board.skin === 'running' ? (
          /* 러닝 — 말머리는 첫 화면의 카드로 고른다. 고른 뒤에는 돌아가기 + 지금 말머리 */
          <div className="seg cat-tabs">
            {runCat ? (
              <>
                <button onClick={() => { router.push(runHref()); setPage(1); }}>‹ 전체</button>
                <button className="on">{runCat}</button>
              </>
            ) : <button className="on">전체 {board.cats.length}</button>}
          </div>
        ) : (
        <div className="seg cat-tabs">
          {/* 「공지」는 설정 말머리가 아니라 공지 고정 글 모아보기 — 이 게시판에 공지 글이 있을 때만 (사용자 요청) */}
          {['전체', ...(posts.some(p => (p.boardId ?? MAIN_BOARD_ID) === board.id && p.notice) ? ['공지'] : []), ...board.cats.map(x => x.label)].map(c => (
            <button key={c} className={cat === c ? 'on' : ''} onClick={() => { setCat(c); setPage(1); }}>{c}</button>
          ))}
        </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBar onSearch={v => { setQ(v); setPage(1); }} />
          {/* 이 게시판 말머리 바로 고치기 (사용자 요청) — 환경설정 › 게시판 관리 › 말머리와 같은 자료 */}
          {isAdmin && <button className="btn btn-ghost" onClick={() => setCatsOpen(true)}>말머리 관리</button>}
          {/* 글쓰기 권한 — 게시판 설정의 permWrite + 「글쓰기 멤버」로 좁히기 (v2.1) */}
          {canWriteAt(menuSet, boardHref(board.id), { loggedIn: !!user, isAdmin, id: user?.id }, 'member', board.permWrite) && (
            <button className="btn btn-dark" onClick={() => router.push(`/board/write?b=${board.id}`)}>✎ WRITE</button>
          )}
        </div>
      </div>

      {board.skin === 'running' && !runCat && !q ? (
        /* 러닝 첫 화면 (B 디자인) — 말머리(캐릭터 등)마다 세로 카드, 누르면 그 말머리 글만 */
        <div className="run-pick">
          {board.cats.map(c => {
            const cov = runCover(c.label);
            return (
              <div key={c.id} className="run-card" onClick={() => { router.push(runHref(c.label)); setPage(1); }}>
                {cov ? <CropImg src={cov.src} crop={cov.crop} /> : <div className="run-ph" />}
                <div className="nm"><b>{c.label}</b><small>{runCount(c.label)}</small></div>
              </div>
            );
          })}
          {board.cats.length === 0 && <div className="panel" style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>환경설정 &gt; 게시판 관리에서 말머리(캐릭터 등)를 만들어 주세요</div>}
        </div>
      ) : board.skin === 'running' ? (
        /* 러닝 글 카드 — 대표 이미지 + 말머리 + 제목 + 요약 + 날짜 */
        <div className="run-grid">
          {pageList.map(p => {
            const thumb = canRead(p) && !locked(p) ? (p.thumbSrc ?? firstImage(p.body)) : null;
            return (
              <div key={p.id} className="panel run-item" onClick={() => go(p)}>
                <div className="thumb">{thumb ? <CropImg src={thumb} crop={p.thumbSrc ? p.thumbCrop : undefined} /> : <div className="run-ph">{(locked(p) || !canRead(p)) && <LockIcon />}</div>}</div>
                <div className="info">
                  <small className="cat">{p.category}{pubTag(p)}</small>
                  <b>{canRead(p) ? p.title : '비밀글입니다'}{(p.secret || p.fold || locked(p)) && <LockIcon />}{canRead(p) && cmtCount(p) > 0 && <span className="cmt">{cmtCount(p)}</span>}</b>
                  {canRead(p) && !locked(p) && p.summary && <p>{p.summary}</p>}
                  <small className="dt">{fmtDate(p.date)}</small>
                </div>
              </div>
            );
          })}
          {pageList.length === 0 && <div className="panel" style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)', gridColumn: '1/-1' }}>게시글이 없습니다</div>}
        </div>
      ) : board.skin === 'talk' ? (
        /* 썰 백업 (B 디자인) — 「대화 N」 + 제목 + 날짜 한 줄 */
        <div className="talk-list" style={board.fg ? { color: board.fg } : undefined}>
          {pageList.map(p => (
            <div key={p.id} className="panel talk-li" onClick={() => go(p)}>
              <span className="talk-n">{canRead(p) && !locked(p) ? `대화 ${talkCount(p.body)}` : 'LOCK'}</span>
              <b>{canRead(p) ? p.title : '비밀글입니다'}{(p.secret || p.fold || locked(p)) && <LockIcon />}{canRead(p) && cmtCount(p) > 0 && <span className="cmt">{cmtCount(p)}</span>}</b>
              {pubTag(p)}
              <small>{p.category && <>{p.category} · </>}{fmtDate(p.date)}</small>
              <i className="ar">›</i>
            </div>
          ))}
          {pageList.length === 0 && <div className="panel" style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>게시글이 없습니다</div>}
        </div>
      ) : board.skin === 'ticket' ? (
        /* 티켓형 스킨 (5.2 v1.9) — 왼쪽 썸네일(본문 첫 이미지) + 절취선 + 오른쪽 글 정보 */
        <div style={board.fg ? { color: board.fg } : undefined}>
          {pageList.map(p => {
            // 대표 이미지(직접 선택 + 크롭) 우선, 없으면 본문 첫 이미지 (v1.9)
            const thumb = canRead(p) && !locked(p) ? (p.thumbSrc ?? firstImage(p.body)) : null;
            return (
              <div className="bticket" key={p.id} onClick={() => { if (canRead(p)) router.push(`/board/${p.id}`); }}>
                <div className="bt-thumb">
                  {thumb
                    ? <CropImg src={thumb} crop={p.thumbSrc ? p.thumbCrop : undefined} />
                    : <div className="bt-ph">{(canRead(p) ? p.title : 'SECRET').slice(0, 1).toUpperCase()}</div>}
                </div>
                <div className="bt-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {postBadge(p)}{pubTag(p)}
                  </div>
                  <div className="bt-title">
                    {canRead(p) ? <>{p.title}{(p.secret || p.fold || locked(p)) && <LockIcon />}</> : <>비밀글입니다<LockIcon /></>}
                    {canRead(p) && cmtCount(p) > 0 && <span className="cmt">{cmtCount(p)}</span>}
                  </div>
                  <div className="bt-meta">{p.author} · {fmtDate(p.date)}</div>
                </div>
              </div>
            );
          })}
          {pageList.length === 0 && (
            <div className="panel" style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>게시글이 없습니다</div>
          )}
        </div>
      ) : (
        /* 기본형 스킨 — 리스트 행 (글씨색은 게시판 관리에서 지정 가능, v1.9) */
        <div className="panel board-list flush" style={board.fg ? { color: board.fg } : undefined}>
          {pageList.map(p => (
            <div className="brow" key={p.id} onClick={() => { if (canRead(p)) router.push(`/board/${p.id}`); }}>
              <span className="cat">{postBadge(p)}</span>
              {/* 제목 칸 안에서 태그를 오른쪽 끝(=작성자 바로 왼쪽)에 정렬 (v2.0 사용자 요청) —
                  칸을 따로 만들면 행마다 그리드가 독립이라 작성자 열이 태그 길이만큼 어긋난다 */}
              <div className="tcell">
                {canRead(p) ? (
                  <b>
                    {p.title}{(p.secret || p.fold || locked(p)) && <LockIcon />}
                    {cmtCount(p) > 0 && <span className="cmt">{cmtCount(p)}</span>}
                    {pubTag(p)}
                  </b>
                ) : (
                  <b style={{ color: 'var(--faint)' }}>비밀글입니다<LockIcon /></b>
                )}
                {canRead(p) && (p.tags ?? []).length > 0 && (
                  <span className="tags">{(p.tags ?? []).map(t => <i key={t}>#{t}</i>)}</span>
                )}
              </div>
              <span className="who">{p.author}</span>
              <span className="dt">{fmtDate(p.date)}</span>
            </div>
          ))}
          {pageList.length === 0 && (
            <div style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>게시글이 없습니다</div>
          )}
        </div>
      )}
      {!(board.skin === 'running' && !runCat && !q) && <Pager page={page} total={totalPages} onChange={setPage} />}
    </section>
  );
}

export default function BoardPage() {
  // useSearchParams는 Suspense 경계 필요 (Next App Router)
  return <Suspense fallback={<section className="page" />}><BoardInner /></Suspense>;
}
