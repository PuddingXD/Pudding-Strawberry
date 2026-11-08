'use client';
// 그림백업 상세 (4.11) — 로그형: 세로 스크롤 뷰어 / 단일형: 큰 이미지 + 썸네일 스트립 + 좌우 넘김
// v2.1: 큰 그림 게시판(/feed)도 같은 상세를 쓴다 — kind로 저장 자리·돌아갈 곳만 갈린다 (유형 뱃지는 갤러리에만)
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHrefBlock } from '@/components/shell/MenuGuard';
import { sectionHref, MAIN_SEC, useSectionTitle } from '@/lib/sectionStore';
import { useAuth } from '@/lib/auth';
import { useLocalList, fmtDate } from '@/lib/postStore';
import { BackupPost, BACKUP_SEED, FEED_KEY, FEED_SEED, sortBackup } from '@/lib/galleryStore';
import { ConfirmModal } from '@/components/ui/Modal';
import { useBlobUrl, isVideoRef, blobUrlOf } from '@/lib/blobStore';
import { sanitizeHtml } from '@/lib/sanitize';
import { PageTitle } from '@/components/ui/PageText';
import { Lightbox } from '@/components/ui/Lightbox';
import { PrevNext, pickNeighbors, useScrollTopOnChange } from '@/components/ui/PrevNext';
import { useBoardSettings, boardBadgeStyle, feedCatsOf, galleryCatsOf, feedHideAuthorOf } from '@/lib/boardStore';

export function BackupDetail({ kind }: { kind: 'gallery' | 'feed' }) {
  const feed = kind === 'feed';
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [posts, setPosts, loaded] = useLocalList<BackupPost>(feed ? FEED_KEY : 'ohome.backup.v1', feed ? FEED_SEED : BACKUP_SEED);
  const [cur, setCur] = useState(0);
  const [delAsk, setDelAsk] = useState(false);
  const [lbOpen, setLbOpen] = useState(false); // 단일형 — 클릭 확대 보기
  const { st: boardSet } = useBoardSettings(); // 유형 뱃지 색 (환경설정 > 게시판 관리)

  const p = posts.find(x => x.id === id);
  // 이전글/다음글로 글이 바뀌면 — 보던 이미지 순번·확대·삭제창을 비우고 맨 위로
  useEffect(() => { setCur(0); setLbOpen(false); setDelAsk(false); }, [id]);
  useScrollTopOnChange(id);
  /* 이 글이 속한 곳이 비공개면 주소로 들어와도 열리지 않게 (v2.0 사용자 요청).
     글 주소에는 섹션이 없어 MenuGuard가 못 막는다 — 글을 읽어 소속을 알아낸 여기서 판정한다.
     **다른 early return보다 먼저 불러야 한다**(훅이므로 렌더마다 개수가 같아야 한다) */
  const blocked = useHrefBlock(p && sectionHref(kind, p.secId ?? MAIN_SEC));
  /* 화살표(단일형) 보기 — 넘겨도 모든 그림이 같은 세로 높이 (사용자 요청).
     그림들의 「칸 폭에 맞춘 높이」 중 가장 큰 값으로 무대 높이를 고정하고(화면의 80%까지), 각 그림은 그 높이에 맞춘다.
     화살표 위치도 넘길 때마다 들썩이지 않는다 */
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageH, setStageH] = useState<number | null>(null);
  const singleKey = p && p.type !== 'log' && p.type !== 'pair' && p.type !== 'vlist' ? p.images.join('|') : '';
  useEffect(() => {
    setStageH(null);
    if (!singleKey) return;
    let alive = true;
    const refs = singleKey.split('|').filter(Boolean);
    void (async () => {
      const dims = await Promise.all(refs.map(async r => {
        if (isVideoRef(r)) return null;
        const u = await blobUrlOf(r);
        if (!u) return null;
        return new Promise<{ w: number; h: number } | null>(res => {
          const im = new Image();
          im.onload = () => res(im.naturalWidth > 0 ? { w: im.naturalWidth, h: im.naturalHeight } : null);
          im.onerror = () => res(null);
          im.src = u;
        });
      }));
      if (!alive) return;
      const W = stageRef.current?.clientWidth || 632;
      const hs = dims.filter((d): d is { w: number; h: number } => !!d).map(d => Math.min(d.h, (W * d.h) / d.w));
      if (!hs.length) return;
      setStageH(Math.round(Math.min(Math.max(...hs), window.innerHeight * 0.8)));
    })();
    return () => { alive = false; };
  }, [singleKey]);
  // 큰 글씨 — 추가 섹션이면 그 이름, 눌렀을 때도 그 목록으로 (v2.0 사용자 제보)
  const tt = useSectionTitle(kind, p?.secId, feed ? 'WORKS' : 'GALLERY');
  if (blocked) return blocked;
  if (!loaded) return <section className="page" />;
  if (!p || (p.visibility === 'private' && !isAdmin) || (p.visibility === 'member' && !user)) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><p>게시물을 찾을 수 없거나 열람 권한이 없습니다</p></div>
      </section>
    );
  }

  const imgs: { url?: string; ph?: string }[] = p.images.length
    ? p.images.map(u => ({ url: u }))
    : p.phList.map(c => ({ ph: c }));
  /* 글쓴이 확인 (v2.0 발견) — **둘 다 없을 때 같다고 보면 안 된다.**
     예전 글이나 손님이 쓴 글은 authorId가 없는데, 비로그인 방문자도 user?.id가 없어
     `undefined === undefined`로 통과했다 — 아무나 남의 글을 고치고 지울 수 있었다 */
  const canManage = isAdmin || (!!p.authorId && p.authorId === user?.id);
  // 말머리 뱃지 — 색은 환경설정 > 게시판 관리의 말머리 설정 (큰 그림·갤러리 공통)
  const badge = feed
    ? feedCatsOf(boardSet, p.secId ?? MAIN_SEC).find(c => c.label === p.category)
    : galleryCatsOf(boardSet, p.secId ?? MAIN_SEC).find(c => c.label === p.category);
  const badgeLabel = p.category;   // 갤러리도 유형(로그/화살표…)이 아니라 말머리를 뱃지로 (v2.1 사용자 요청)
  // 큰 그림 게시판 — 작성자 이름 숨기기 (환경설정 > 게시판 관리, v2.1)
  const hideAuthor = feed && feedHideAuthorOf(boardSet, p.secId ?? MAIN_SEC);

  // 파일 id/URL 모두 지원 — blobStore에서 로드 (새로고침에도 유지)
  // natural: 고정 프레임 안에서 확대 없이 원본 크기 그대로 가운데 (단일형 — 프레임보다 크면 축소만)
  const Img = ({ im, ratio, natural, stage }: { im: { url?: string; ph?: string }; ratio?: string; natural?: boolean; stage?: boolean }) => {
    const u = useBlobUrl(im.url);
    // 화살표 보기 무대 — 무대 높이에 맞춤 (가로로 넓어 폭이 모자라면 그만큼만 줄어든다)
    const stageSt: React.CSSProperties = { height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto' };
    if (u && stage) {
      return isVideoRef(im.url)
        ? <video src={u} controls playsInline preload="metadata" style={stageSt} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={u} alt="" style={stageSt} />;
    }
    if (u && isVideoRef(im.url)) {
      // 영상 — 직접 재생 (소리·전체화면은 컨트롤로). 사진과 같은 폭 규칙
      return <video src={u} controls playsInline preload="metadata" style={natural
        ? { maxWidth: '100%', maxHeight: '100%', display: 'block' }
        : { maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />;
    }
    if (u) {
      // eslint-disable-next-line @next/next/no-img-element
      // 원본보다 크게 늘리지 않는다 — 폭이 모자랄 때만 줄이고, 작은 그림은 작은 그대로 (v2.0 사용자 확정)
      return <img src={u} alt="" style={natural
        ? { maxWidth: '100%', maxHeight: '100%', display: 'block' }
        : { maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />;
    }
    return <div className={`ph ${im.ph ?? ''}`}
      style={natural ? { width: '100%', height: '100%' } : { aspectRatio: ratio ?? '16/10' }}><span>IMAGE</span></div>;
  };

  const nb = pickNeighbors(
    (feed ? posts : sortBackup(posts)).filter(x => (x.secId ?? MAIN_SEC) === (p.secId ?? MAIN_SEC)
      && !(x.visibility === 'private' && !isAdmin) && !(x.visibility === 'member' && !user)),
    p.id,
  );
  const navOf = (x: BackupPost | null) => (x ? { href: `/${kind}/${x.id}`, title: x.title } : null);

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={tt.href}>{tt.title}</PageTitle>
        <p>
          {p.category}{hideAuthor ? '' : ` · ${p.author}`} · {fmtDate(p.date)}{p.madeDate ? ` · 제작 ${p.madeDate}` : ''}
          {/* 태그 (v2.0 사용자 요청) — 목록과 같은 표기 */}
          {(p.tags ?? []).map(t => <i key={t} className="tag-in">#{t}</i>)}
        </p>
        <div className="head-actions">
          {canManage && <button className="btn btn-dark" onClick={() => router.push(`/${kind}/${p.id}/edit`)}>EDIT</button>}
          {canManage && <button className="btn btn-dark" onClick={() => setDelAsk(true)}>DELETE</button>}
        </div>
      </div>

      {/* 본문만 폭 제한 — 헤더는 풀폭 위치 유지 */}
      {/* 큰 그림은 패널째 70%(672px)로 — 이미지는 패널을 꽉 채운다 (v2.1 사용자 요청) */}
      {/* 갤러리 본문 카드도 큰 그림과 같은 672px (v2.1 사용자 요청 — 예전엔 960px) */}
      {/* 카드는 가름선 길이만큼, 그림·글 폭은 그대로 672 (사용자 요청 — .body-card.wide) */}
      <div className="panel body-card wide" style={{ padding: 20, ['--bc-in' as string]: '632px' } as React.CSSProperties}>
        {/* 제목·뱃지 세로 중앙 정렬 + 아래 여백 확보 */}
        <h2 style={{ fontSize: 18, marginBottom: p.desc ? 8 : 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          {p.title}
          {badgeLabel && <span style={boardBadgeStyle(badge)}>{badgeLabel}</span>}
        </h2>
        {p.desc && (
          <div className="post-body" style={{ fontSize: 12.5, margin: '0 0 16px' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.desc) }} />
        )}

        {p.type === 'log' ? (
          /* 로그형 — 웹툰식 세로 스크롤 · 이미지 사이 틈 없이 이어 붙임 (만화 연결) */
          <div style={{ borderRadius: 10, overflow: 'hidden' }}>
            {imgs.map((im, i) => <Img key={i} im={im} />)}
          </div>
        ) : p.type === 'pair' ? (
          /* 나란히 (이미지 2개씩) — 약간의 공백을 두고 가로로 2개, 클릭 확대 */
          <div className="g-pair">
            {imgs.map((im, i) => (
              <div key={i} className="g-pair-i" style={{ cursor: im.url ? 'zoom-in' : undefined }}
                onClick={() => { if (im.url) { setCur(i); setLbOpen(true); } }}>
                <Img im={im} ratio="4/3" />
              </div>
            ))}
          </div>
        ) : p.type === 'vlist' ? (
          /* 단일(세로정렬) (v1.9) — 로그와 달리 이미지 사이 갭을 두고 세로로 나열, 클릭 확대 */
          <div style={{ display: 'grid', gap: 14 }}>
            {imgs.map((im, i) => (
              <div key={i} style={{ borderRadius: 10, overflow: 'hidden', cursor: im.url ? 'zoom-in' : undefined }}
                onClick={() => { if (im.url) { setCur(i); setLbOpen(true); } }}>
                <Img im={im} />
              </div>
            ))}
          </div>
        ) : (
          /* 단일형 — 큰 이미지 + 좌우 넘김 + 썸네일 스트립 */
          <>
            <div className="single-viewer" ref={stageRef} style={stageH ? { height: stageH } : undefined}>
              <div style={{ cursor: imgs[cur].url ? 'zoom-in' : undefined, height: stageH ? '100%' : undefined }}
              onClick={() => { if (imgs[cur].url) setLbOpen(true); }}>
              <Img im={imgs[cur]} stage={!!stageH} />
              </div>
              {imgs.length > 1 && (
                <>
                  <button className="nav" style={{ left: 10 }}
                    onClick={() => setCur(c => (c - 1 + imgs.length) % imgs.length)}>◁</button>
                  <button className="nav" style={{ right: 10 }}
                    onClick={() => setCur(c => (c + 1) % imgs.length)}>▷</button>
                </>
              )}
            </div>
            {imgs.length > 1 && (
              <div className="thumb-strip">
                {imgs.map((im, i) => (
                  <div key={i} className={`t ${i === cur ? 'on' : ''}`} onClick={() => setCur(i)}>
                    <Img im={im} ratio="4/3" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {/* 이전글/다음글 — 같은 갤러리(섹션) 안에서, 내가 볼 수 있는 글만 · 본문 카드 안 (사용자 요청) */}
        <PrevNext
          prev={navOf(nb.prev)}
          next={navOf(nb.next)} />
      </div>

      {/* 단일형·단일(세로)·나란히 확대 보기 — 뷰어와 같은 순번에서 시작, ‹ ›로 이어 넘김 */}
      {lbOpen && (p.type === 'single' || p.type === 'vlist' || p.type === 'pair') && p.images.length > 0 && (
        <Lightbox srcs={p.images} index={cur} onClose={() => setLbOpen(false)} />
      )}

      <ConfirmModal open={delAsk} title="게시물을 삭제하시겠습니까?" body="삭제한 게시물은 복구할 수 없습니다."
        onClose={() => setDelAsk(false)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => { setPosts(posts.filter(x => x.id !== p.id)); router.push(tt.href); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelAsk(false) },
        ]} />
    </section>
  );
}
