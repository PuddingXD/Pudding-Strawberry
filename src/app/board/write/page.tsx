'use client';
// 게시판 글쓰기/수정 (4.2 / 5.2 다중 게시판) — MD/HTML 모드 선택 + 실시간 미리보기 + 접기/비밀글/공지 설정
// ?edit=<글 id> 로 진입하면 수정 모드 (작성자·관리자만)
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { nowIso } from '@/lib/order';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList, BOARD_SEED, Post, newId, FoldType, talkPeople, type TalkPerson } from '@/lib/postStore';
import { useBoards, boardHref, MAIN_BOARD_ID } from '@/lib/boardStore';
import { useMenuSettings, canWriteAt } from '@/lib/menuStore';
import { renderBody } from '@/lib/sanitize';
import { KInput, KTextarea, KSelect, KCheck, KRadio, KDate } from '@/components/ui/Kit';
import { ColorField } from '@/components/ui/ColorField';
import { lockText, unlockText, unlockedOf, rememberUnlocked } from '@/lib/pwLock';
import { CropEditor, CropImg, CropValue } from '@/components/ui/CropEditor';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { parseKakao, kakaoToBody, swapTalkNumbers, type KakaoParsed, type KakaoSlot } from '@/lib/kakao';
import { RichEditor } from '@/components/ui/RichEditor';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

/** 에디터가 다루지 못해 정리될 만한 태그·속성이 있는가 — 전환 경고 판단 (인트로와 같은 기준) */
const hasRichHtml = (html: string) =>
  /<(table|thead|tbody|tr|td|th|div|span|section|article|video|audio|details|summary|font|center)\b/i.test(html)
  || /\s(style|class|id)\s*=/i.test(html);

function WriteInner() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const editPid = params.get('edit');
  const [posts, setPosts, postsLoaded] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  const editing = editPid ? posts.find(p => p.id === editPid) : undefined;
  const bid = editing?.boardId ?? params.get('b') ?? MAIN_BOARD_ID;
  const { boards } = useBoards();
  const board = boards.find(b => b.id === bid) ?? boards[0];
  const [menuSet, , menuLoaded] = useMenuSettings();
  const [title, setTitle] = useState('');
  const [writeMode, setWriteMode] = useState<'editor' | 'md' | 'html'>('editor'); // 에디터가 기본
  const [body, setBody] = useState('');
  // HTML 모드 안의 보기 (v2.0 사용자 요청) — 코드 그대로 / 미리보기에서 바로 편집
  const [htmlView, setHtmlView] = useState<'code' | 'preview'>('code');
  const [askRich, setAskRich] = useState<null | (() => void)>(null);   // 정리 경고 후 실행할 전환
  const [category, setCategory] = useState('');
  // 말머리 기본값 — 게시판별 목록(5.2) 로드 후 첫 항목
  React.useEffect(() => { if (!category && board.cats[0]) setCategory(board.cats[0].label); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.cats.length]);
  const [secret, setSecret] = useState(false);
  /* ---- B 디자인에서 가져온 옵션 ---- */
  // 공개 시점: 바로 / 예약 / 임시 저장
  const [pubMode, setPubMode] = useState<'now' | 'at' | 'draft'>('now');
  const [pubDate, setPubDate] = useState('');
  const [pubTime, setPubTime] = useState('21:00');
  // 비밀번호 잠금 — 본문을 비밀번호로 암호화 (lib/pwLock)
  const [pwOn, setPwOn] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [needPw, setNeedPw] = useState(false);       // 잠긴 글 수정 — 먼저 풀어야 본문을 채울 수 있다
  const [unlockPw, setUnlockPw] = useState('');
  const [unlockErr, setUnlockErr] = useState('');
  const editPw = useRef('');                          // 잠긴 글을 풀 때 쓴 비밀번호 — 바꾸지 않으면 그대로 다시 잠근다
  const [saving, setSaving] = useState(false);
  // 썰 백업 — 대화 참여자 · 러닝 — 카드 요약
  const [people, setPeople] = useState<TalkPerson[]>(() => talkPeople());
  const setPerson = (i: number, p: Partial<TalkPerson>) => setPeople(ps => ps.map((x, j) => (j === i ? { ...x, ...p } : x)));
  // 카톡 대화 불러오기 (썰 백업) — 파일을 읽고 사람마다 번호를 정한 뒤 본문으로
  const kakaoInput = useRef<HTMLInputElement>(null);
  const [kakao, setKakao] = useState<KakaoParsed | null>(null);
  const [kSlot, setKSlot] = useState<Record<string, KakaoSlot>>({});
  const [kDates, setKDates] = useState(true);
  const [kAppend, setKAppend] = useState(false);
  // 번호 바꾸기 — 본문의 N: 줄과 참여자 이름·색을 함께 맞바꾼다 (왼쪽/오른쪽 자리는 번호에 남는다)
  const [swA, setSwA] = useState('1');
  const [swB, setSwB] = useState('2');
  const swapNumbers = () => {
    const a = Number(swA), b = Number(swB);
    if (a === b) { toast('서로 다른 번호를 골라 주세요'); return; }
    setBody(bd => swapTalkNumbers(bd, a, b));
    setPeople(ps => ps.map((x, i) => {
      if (i === a - 1) return { ...ps[b - 1], side: x.side };
      if (i === b - 1) return { ...ps[a - 1], side: x.side };
      return x;
    }));
    toast(`${a}번과 ${b}번을 바꿨습니다`);
  };
  const [summary, setSummary] = useState('');
  const [notice, setNotice] = useState(false);
  // 태그 (v2.0 사용자 요청) — 쉼표로 구분해 입력, 저장할 때 배열로
  const [tagsText, setTagsText] = useState('');
  const parseTags = (s: string) =>
    [...new Set(s.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean))];
  const [foldType, setFoldType] = useState<FoldType | 'none'>('none');
  const [foldLabel, setFoldLabel] = useState('');
  // 티켓 스킨 대표 이미지 (v1.9) — 본문에 삽입한 이미지 중 선택 + 16:9 썸네일 크롭
  const [thumbSrc, setThumbSrc] = useState<string | undefined>(undefined);
  const [thumbCrop, setThumbCrop] = useState<CropValue | undefined>(undefined);
  const [cropOpen, setCropOpen] = useState(false);
  // 본문 이미지 목록 — HTML <img> + Markdown 이미지
  const bodyImages = useMemo(() => {
    const out: string[] = [];
    for (const m of body.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)) out.push(m[1]);
    for (const m of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) out.push(m[1]);
    return [...new Set(out)];
  }, [body]);
  // 대표로 지정한 이미지가 본문에서 삭제되면 해제
  useEffect(() => {
    if (thumbSrc && !bodyImages.includes(thumbSrc)) { setThumbSrc(undefined); setThumbCrop(undefined); }
  }, [bodyImages, thumbSrc]);

  // 수정 모드 — 저장본 로드가 끝나면 폼을 한 번 채움 (본문은 저장 모드 그대로: md→Markdown, html→HTML)
  const hydrated = useRef(false);
  useEffect(() => {
    if (!editPid || !postsLoaded || hydrated.current) return;
    const p = posts.find(x => x.id === editPid);
    if (!p) return;
    hydrated.current = true;
    setTitle(p.title);
    if (p.pwLock) {
      setPwOn(true);
      const t = unlockedOf(p.id);
      if (t === undefined) setNeedPw(true); else setBody(t);
    } else setBody(p.body);
    setPubMode(p.draft ? 'draft' : p.pubAt && new Date(p.pubAt).getTime() > Date.now() ? 'at' : 'now');
    if (p.pubAt) {
      const d = new Date(p.pubAt); const z = (n: number) => String(n).padStart(2, '0');
      setPubDate(`${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`); setPubTime(`${z(d.getHours())}:${z(d.getMinutes())}`);
    }
    setPeople(talkPeople(p.talk));
    setSummary(p.summary ?? '');
    // 에디터로 쓴 글은 에디터로 다시 연다 — 예전에는 무조건 HTML 소스가 떠서
    // 에디터로 쓴 글을 수정하면 갑자기 태그가 보였다 (authored 없는 옛 글은 지금까지대로 HTML)
    setWriteMode(p.mode === 'md' ? 'md' : (p.authored === 'editor' ? 'editor' : 'html'));
    setCategory(p.category);
    setSecret(p.secret); setNotice(p.notice);
    setFoldType(p.fold?.type ?? 'none'); setFoldLabel(p.fold?.label ?? '');
    setTagsText((p.tags ?? []).join(', '));
    setThumbSrc(p.thumbSrc); setThumbCrop(p.thumbCrop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPid, postsLoaded, posts]);

  const preview = useMemo(() => renderBody(writeMode === 'md' ? 'md' : 'html', body), [writeMode, body]);

  if (!user) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>WRITE</PageTitle><p>글쓰기는 로그인 후 이용할 수 있습니다</p></div>
      </section>
    );
  }
  /* 글쓰기 권한 (v2.1) — WRITE 버튼과 같은 판정으로 주소 직접 진입도 막는다. 새 글만 — 자기 글 수정은 그대로.
     설정을 읽기 전에는 폼을 그리지 않는다 */
  if (!editPid && !menuLoaded) return <section className="page" />;
  if (!editPid && !canWriteAt(menuSet, boardHref(board.id), { loggedIn: true, isAdmin, id: user.id }, 'member', board.permWrite)) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>WRITE</PageTitle><p>허용된 회원만 글을 쓸 수 있는 게시판입니다</p></div>
      </section>
    );
  }

  // 잠긴 글 수정 — 비밀번호로 먼저 풀기
  if (editing && needPw) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={boardHref(board.id)}>EDIT</PageTitle><p>비밀번호가 걸린 글 — 본문을 고치려면 먼저 풀어 주세요</p></div>
        <div className="panel" style={{ maxWidth: 420, margin: '20px auto', padding: 24 }}>
          <form className="pw-box" style={{ border: 'none', padding: 0 }} onSubmit={async e => {
            e.preventDefault();
            const t = await unlockText(editing.pwLock!, unlockPw);
            if (t === null) { setUnlockErr('비밀번호가 맞지 않습니다'); return; }
            rememberUnlocked(editing.id, t); editPw.current = unlockPw;
            setBody(t); setNeedPw(false);
          }}>
            <div className="row">
              <KInput type="password" autoComplete="off" placeholder="비밀번호" value={unlockPw} onChange={e => setUnlockPw(e.target.value)} />
              <button className="btn btn-dark" type="submit">열기</button>
            </div>
            {unlockErr && <small className="err">{unlockErr}</small>}
          </form>
        </div>
      </section>
    );
  }

  /** 공개 시점·잠금·스킨별 칸을 글 데이터로 */
  const extras = async (): Promise<Partial<Post> | null> => {
    let pubAt: string | undefined;
    if (pubMode === 'at') {
      if (!pubDate) { toast('예약 공개 날짜를 골라 주세요'); return null; }
      const d = new Date(`${pubDate}T${pubTime || '00:00'}`);
      if (Number.isNaN(d.getTime())) { toast('예약 공개 시각을 확인해 주세요'); return null; }
      pubAt = d.toISOString();
    }
    let lock: Post['pwLock'];
    let savedBody = body;
    if (pwOn) {
      const p = pw1 || editPw.current;
      if (!p) { toast('비밀번호를 입력해 주세요'); return null; }
      if (pw1 && pw1 !== pw2) { toast('비밀번호 확인이 맞지 않습니다'); return null; }
      lock = await lockText(body, p);
      savedBody = '';
    }
    return {
      body: savedBody, pwLock: lock,
      pubAt, draft: pubMode === 'draft' ? true : undefined, visibility: pubMode === 'draft' ? 'private' : undefined,
      talk: board.skin === 'talk' ? { people: people.map(x => ({ name: x.name.trim(), color: x.color || undefined, side: x.side })) } : editing?.talk,
      summary: board.skin === 'running' ? (summary.trim() || undefined) : editing?.summary,
    };
  };

  const post = async () => {
    if (!title.trim() || !body.trim()) { toast('제목과 내용을 입력해 주세요'); return; }
    if (saving) return;
    setSaving(true);
    const ex = await extras();
    setSaving(false);
    if (!ex) return;
    if (editing) {
      // 수정 — 작성자 본인만 (관리자도 타인 글은 삭제만, v1.9). 작성자/날짜/댓글/소속 게시판은 유지
      if (editing.authorId !== user.id) { toast('수정은 작성자 본인만 할 수 있습니다'); return; }
      setPosts(posts.map(p => (p.id === editing.id ? {
        ...p,
        title: title.trim(), body,
        mode: writeMode === 'md' ? 'md' : 'html',
        authored: writeMode === 'editor' ? 'editor' : undefined,
        category,
        secret, notice: isAdmin ? notice : p.notice,
        tags: parseTags(tagsText),
        fold: foldType === 'none' ? null : { type: foldType, label: foldType === 'custom' ? foldLabel : undefined },
        thumbSrc, thumbCrop,
        ...ex,
      } : p)));
      if (ex.pwLock) rememberUnlocked(editing.id, body);
      toast('수정되었습니다');
      router.push(`/board/${editing.id}`);
      return;
    }
    const p: Post = {
      id: newId(), title: title.trim(), body,
      mode: writeMode === 'md' ? 'md' : 'html', category,
      author: user.nickname, authorId: user.id, date: nowIso(),
      secret, notice: isAdmin && notice,
      tags: parseTags(tagsText),
      fold: foldType === 'none' ? null : { type: foldType, label: foldType === 'custom' ? foldLabel : undefined },
      comments: [],
      boardId: board.id,   // 소속 게시판 (5.2 다중 게시판)
      thumbSrc, thumbCrop,
      ...ex,
    };
    if (ex.pwLock) rememberUnlocked(p.id, body);
    setPosts([p, ...posts]);
    toast('등록되었습니다');
    router.push(`/board/${p.id}`);
  };

  return (
    <section className="page">
      {/* 큰 글씨 — 추가 게시판이면 그 이름(메뉴 관리 타이틀·이름이 우선), 누르면 그 게시판으로 복귀
          (v2.0 사용자 제보 — 「글쓰기에서 큰제목을 눌러도 안 돌아가고, 제목도 원래 것이 뜬다」) */}
      <div className="page-head"><PageTitle href={boardHref(board.id)}>{board.id === MAIN_BOARD_ID ? (editing ? 'EDIT' : 'WRITE') : board.name}</PageTitle><EditableDesc k="board-write-desc" def="에디터 / Markdown / HTML — 스크립트는 저장 시 자동 제거" /></div>
      <div className="write-grid">
        {/* 좌: 본문 */}
        <div className="panel" style={{ padding: 24 }}>
          <div className="form-row">
            <label className="k-label" style={{ width: 60 }}>제목</label>
            <KInput value={title} onChange={e => setTitle(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div className="form-row">
            <label className="k-label" style={{ width: 60 }}>모드</label>
            <div className="mini-seg">
              {/* HTML로 쓴 글을 에디터로 열면 다루지 못하는 태그가 정리된다 — 되돌릴 수 없어 물어본다 (v2.0) */}
              <button className={writeMode === 'editor' ? 'on' : ''} onClick={() => {
                if (writeMode === 'html' && hasRichHtml(body)) { setAskRich(() => () => setWriteMode('editor')); return; }
                setWriteMode('editor');
              }}>에디터</button>
              <button className={writeMode === 'md' ? 'on' : ''} onClick={() => { setWriteMode('md'); setHtmlView('code'); }}>Markdown</button>
              <button className={writeMode === 'html' ? 'on' : ''} onClick={() => setWriteMode('html')}>HTML</button>
            </div>
            {/* HTML 모드 안 보기 전환 (v2.0 사용자 요청) — 코드 그대로 / 미리보기에서 바로 편집 */}
            {writeMode === 'html' && (
              <div className="mini-seg">
                <button className={htmlView === 'code' ? 'on' : ''} onClick={() => setHtmlView('code')}>코드</button>
                <button className={htmlView === 'preview' ? 'on' : ''} onClick={() => {
                  if (htmlView === 'preview') return;
                  if (hasRichHtml(body)) { setAskRich(() => () => setHtmlView('preview')); return; }
                  setHtmlView('preview');
                }}>미리보기 (편집 가능)</button>
              </div>
            )}
          </div>
          {/* 썰 백업 게시판 — 대화 참여자 (B 디자인) */}
          {board.skin === 'talk' && (
            <div className="talk-guide">
              {people.map((p, i) => (
                <div key={i} className="form-row" style={{ gap: 8 }}>
                  <label className="k-label" style={{ width: 60 }}>참여자 {i + 1}</label>
                  <KInput value={p.name} onChange={e => setPerson(i, { name: e.target.value })} placeholder={`이름 (${i + 1}:)`} style={{ width: 150 }} />
                  <div className="mini-seg">
                    <button className={p.side === 'l' ? 'on' : ''} onClick={() => setPerson(i, { side: 'l' })}>왼쪽</button>
                    <button className={p.side === 'r' ? 'on' : ''} onClick={() => setPerson(i, { side: 'r' })}>오른쪽</button>
                  </div>
                  <span className="k-label" style={{ marginLeft: 6 }}>말풍선</span>
                  <ColorField value={p.color || '#ffffff'} onChange={v => setPerson(i, { color: v })} />
                  {p.color && <button className="btn btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 10.5 }} onClick={() => setPerson(i, { color: '' })}>기본색</button>}
                </div>
              ))}
              <div className="form-row" style={{ gap: 8 }}>
                <label className="k-label" style={{ width: 60 }}>번호 바꾸기</label>
                <KSelect value={swA} onChange={setSwA} minWidth={90} options={[1, 2, 3, 4].map(n => ({ value: String(n), label: `${n}번${people[n - 1]?.name ? ` · ${people[n - 1].name}` : ''}` }))} />
                <span style={{ color: 'var(--faint)' }}>↔</span>
                <KSelect value={swB} onChange={setSwB} minWidth={90} options={[1, 2, 3, 4].map(n => ({ value: String(n), label: `${n}번${people[n - 1]?.name ? ` · ${people[n - 1].name}` : ''}` }))} />
                <button className="btn btn-ghost" style={{ height: 30, fontSize: 11 }} onClick={swapNumbers}>바꾸기</button>
                <span className="hint" style={{ margin: 0 }}>본문의 대사 번호와 이름·색이 함께 바뀌어요</span>
              </div>
              <div className="form-row" style={{ gap: 8 }}>
                <label className="k-label" style={{ width: 60 }}>카톡</label>
                <button className="btn btn-ghost" style={{ height: 30, fontSize: 11 }} onClick={() => kakaoInput.current?.click()}>카톡 대화 불러오기 (.txt)</button>
                <span className="hint" style={{ margin: 0 }}>카카오톡 「대화 내보내기」 파일 — 사람마다 번호를 정해 본문으로 넣고, 넣은 뒤에도 자유롭게 고칠 수 있어요</span>
                <input ref={kakaoInput} type="file" accept=".txt,text/plain" hidden onChange={async e => {
                  const f = e.target.files?.[0]; e.target.value = '';
                  if (!f) return;
                  const parsed = parseKakao(await f.text());
                  if (!parsed.speakers.length) { toast('카카오톡 대화 형식을 찾지 못했습니다'); return; }
                  // 많이 말한 순서로 1~4번 자동 배정, 나머지는 빼기
                  const auto: Record<string, KakaoSlot> = {};
                  parsed.speakers.forEach((s, i) => { auto[s.name] = i < 4 ? ((i + 1) as KakaoSlot) : 'skip'; });
                  setKSlot(auto); setKakao(parsed); setKAppend(!!body.trim());
                }} />
              </div>
              <p className="hint" style={{ margin: '-2px 0 12px' }}>
                줄마다 <b>1: 대사</b> ~ <b>4: 대사</b>로 적어 주세요 (쓰지 않는 번호는 비워 두면 돼요). <b># 소제목</b>은 대화 묶음 구분, 그 밖의 줄은 가운데 지문이 됩니다.
                이미지를 넣으면 바로 위 줄을 말한 사람의 말풍선에 들어갑니다. 말풍선 색을 안 고르면 테마 색으로 나와요.
              </p>
            </div>
          )}
          {/* 러닝 게시판 — 카드 요약 (B 디자인) */}
          {board.skin === 'running' && (
            <div className="form-row">
              <label className="k-label" style={{ width: 60 }}>요약</label>
              <KInput value={summary} onChange={e => setSummary(e.target.value)} placeholder="목록 카드에 보일 한 줄 (선택)" style={{ flex: 1 }} />
            </div>
          )}
          {writeMode === 'editor' || (writeMode === 'html' && htmlView === 'preview') ? (
            <RichEditor value={body} onChange={setBody} placeholder='내용을 작성하세요 — 이미지 삽입 가능 (스크립트 불허 6.3)' />
          ) : (
            <>
              <KTextarea
                style={{ minHeight: 220, fontFamily: writeMode === 'html' ? 'ui-monospace, Consolas, monospace' : undefined }}
                placeholder={writeMode === 'md' ? '마크다운으로 작성...' : '<div>HTML 코드를 작성/붙여넣기...</div>'}
                value={body} onChange={e => setBody(e.target.value)}
              />
              <div className="preview-box" style={{ marginTop: 14 }}>
                <div className="pv-label">PREVIEW — 실시간 미리보기</div>
                <div className="post-body" dangerouslySetInnerHTML={{ __html: preview }} />
              </div>
            </>
          )}
          {/* 티켓 스킨 대표 이미지 — 본문에 삽입한 이미지 리스트에서 선택, 클릭 시 16:9 썸네일 위치 지정 (v1.9) */}
          {(board.skin === 'ticket' || board.skin === 'running') && bodyImages.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <label className="k-label" style={{ marginBottom: 7 }}>대표 이미지 (티켓 썸네일)</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {bodyImages.map(src => (
                  <div key={src}
                    data-tip={thumbSrc === src ? '썸네일 위치 조정' : '대표로 선택'}
                    onClick={() => { if (thumbSrc !== src) { setThumbSrc(src); setThumbCrop(undefined); } setCropOpen(true); }}
                    style={{
                      width: 104, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', cursor: 'var(--cur-pointer,pointer)',
                      position: 'relative', flexShrink: 0,
                      outline: thumbSrc === src ? '2px solid var(--accent)' : '1px solid var(--line)', outlineOffset: 2,
                    }}>
                    <CropImg src={src} crop={thumbSrc === src ? thumbCrop : undefined} />
                    {thumbSrc === src && (
                      <span style={{
                        position: 'absolute', right: 4, top: 4, fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
                        background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: 999,
                      }}>대표</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* 우: 설정 */}
        <div>
          <div className="panel widget" style={{ marginBottom: 14 }}>
            <h4>설정</h4>
            <div className="form-row">
              <label className="k-label" style={{ width: 60 }}>말머리</label>
              <KSelect minWidth={130} value={category} onChange={setCategory}
                options={board.cats.map(x => ({ value: x.label, label: x.label }))} placeholder='말머리 선택' />
            </div>
            {/* 태그 (v2.0 사용자 요청) — 목록의 작성자 왼쪽에 나열되고 검색에 걸린다 */}
            <div className="form-row">
              <label className="k-label" style={{ width: 60 }}>태그</label>
              <KInput value={tagsText} onChange={e => setTagsText(e.target.value)}
                placeholder="쉼표로 구분" style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              <KCheck label="비밀글 (관리자·지정된 회원만 열람)" checked={secret} onChange={setSecret} />
              {isAdmin && <KCheck label="공지로 고정" checked={notice} onChange={setNotice} />}
            </div>
          </div>
          {/* 공개 시점 · 비밀번호 (B 디자인) */}
          <div className="panel widget" style={{ marginBottom: 14 }}>
            <h4>공개</h4>
            <div style={{ display: 'grid', gap: 9 }}>
              <KRadio name="pub" value="now" current={pubMode} onChange={v => setPubMode(v as 'now')} label="바로 공개" />
              <KRadio name="pub" value="at" current={pubMode} onChange={v => setPubMode(v as 'at')} label="예약 공개 — 정한 시각부터 보임" />
              {pubMode === 'at' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 22 }}>
                  <KDate value={pubDate} onChange={setPubDate} />
                  <KInput type="time" value={pubTime} onChange={e => setPubTime(e.target.value)} style={{ width: 110 }} />
                </div>
              )}
              <KRadio name="pub" value="draft" current={pubMode} onChange={v => setPubMode(v as 'draft')} label="임시 저장 — 나와 관리자만" />
              <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
              <KCheck label="비밀번호 잠금 — 비밀번호를 아는 사람만" checked={pwOn} onChange={setPwOn} />
              {pwOn && (
                <div style={{ display: 'grid', gap: 6, paddingLeft: 22 }}>
                  <KInput type="password" autoComplete="new-password" placeholder={editPw.current ? '새 비밀번호 (비우면 그대로)' : '비밀번호'} value={pw1} onChange={e => setPw1(e.target.value)} />
                  <KInput type="password" autoComplete="new-password" placeholder="비밀번호 확인" value={pw2} onChange={e => setPw2(e.target.value)} />
                  <p className="hint" style={{ margin: 0 }}>본문이 이 비밀번호로 암호화돼 저장됩니다. 잊으면 관리자도 열 수 없어요.</p>
                </div>
              )}
            </div>
          </div>
          <div className="panel widget" style={{ marginBottom: 14 }}>
            <h4>접기 (6.2)</h4>
            <div style={{ display: 'grid', gap: 9 }}>
              <KCheck label="스포일러 접기" checked={foldType === 'spoiler'}
                onChange={v => setFoldType(v ? 'spoiler' : 'none')} />
              <KCheck label="수위 주의 접기" checked={foldType === 'adult'}
                onChange={v => setFoldType(v ? 'adult' : 'none')} />
              <KCheck label="직접 입력 문구" checked={foldType === 'custom'}
                onChange={v => setFoldType(v ? 'custom' : 'none')} />
              {foldType === 'custom' && (
                <KInput placeholder="접기 문구" value={foldLabel} onChange={e => setFoldLabel(e.target.value)} />
              )}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-onbk"
              onClick={() => router.push(editing ? `/board/${editing.id}` : boardHref(board.id))}>CANCEL</button>
            <button className="btn btn-accent" disabled={saving} onClick={() => void post()}>{saving ? '…' : editing ? 'SAVE' : pubMode === 'draft' ? '임시 저장' : 'POST'}</button>
          </div>
        </div>
      </div>

      {/* 카톡 대화 불러오기 — 사람마다 번호(1~4)·지문·빼기 */}
      <Modal open={kakao !== null} onClose={() => setKakao(null)} title="카톡 대화 불러오기"
        desc={kakao ? `${kakao.title ? `「${kakao.title}」 · ` : ''}메시지 ${kakao.items.filter(i => i.kind === 'msg').length}개 · 사람마다 말풍선 번호를 정해 주세요` : ''}
        actions={<>
          <button className="btn btn-ghost" onClick={() => setKakao(null)}>CANCEL</button>
          <button className="btn btn-dark" onClick={() => {
            if (!kakao) return;
            const html = kakaoToBody(kakao, kSlot, { dates: kDates });
            setWriteMode('editor');
            setBody(kAppend && body.trim() ? body + html : html);
            // 번호를 정한 사람의 이름을 참여자 칸에
            setPeople(ps => ps.map((x, i) => {
              const who = Object.entries(kSlot).find(([, s]) => s === i + 1)?.[0];
              return who ? { ...x, name: who } : x;
            }));
            if (!title.trim() && kakao.title) setTitle(kakao.title);
            setKakao(null);
            toast('본문에 넣었습니다 — 에디터에서 자유롭게 고칠 수 있어요');
          }}>본문에 넣기</button>
        </>}>
        {kakao && (
          <div style={{ display: 'grid', gap: 8 }}>
            {kakao.speakers.map(s => (
              <div key={s.name} className="form-row" style={{ gap: 10, marginBottom: 0 }}>
                <b style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{s.name} <small style={{ color: 'var(--faint)', fontWeight: 400 }}>{s.count}개</small></b>
                <KSelect value={String(kSlot[s.name] ?? 'skip')} minWidth={140}
                  onChange={v => setKSlot(m => ({ ...m, [s.name]: (/^[1-4]$/.test(v) ? Number(v) : v) as KakaoSlot }))}
                  options={[
                    ...[1, 2, 3, 4].map(n => ({ value: String(n), label: `${n}번 (${people[n - 1]?.side === 'l' ? '왼쪽' : '오른쪽'})` })),
                    { value: 'note', label: '가운데 지문' }, { value: 'skip', label: '빼기' },
                  ]} />
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
            <KCheck label="날짜 바뀌는 곳을 소제목(# 날짜)으로" checked={kDates} onChange={setKDates} />
            {body.trim() && <KCheck label="지금 본문 뒤에 이어 붙이기 (끄면 본문을 바꿔 씀)" checked={kAppend} onChange={setKAppend} />}
          </div>
        )}
      </Modal>

      {/* HTML → 에디터/편집 미리보기 전환 경고 (v2.0) — 다루지 못하는 태그는 편집 순간 정리된다 */}
      <ConfirmModal open={askRich !== null} title="여기서 편집하면 일부 태그가 정리됩니다"
        body="에디터는 굵게·목록·제목·이미지 같은 기본 서식만 다룹니다. 표·div·style·class 등은 편집하는 순간 정리되며 되돌릴 수 없습니다. HTML을 그대로 두려면 취소하세요."
        onClose={() => setAskRich(null)}
        buttons={[
          { label: 'CANCEL', kind: 'ghost', onClick: () => setAskRich(null) },
          { label: '계속', kind: 'accent', onClick: () => { askRich?.(); setAskRich(null); } },
        ]} />

      {/* 대표 썸네일 위치 지정 — 16:9 (티켓 스킨) */}
      {cropOpen && thumbSrc && (
        <CropEditor open src={thumbSrc} aspect="16:9" initial={thumbCrop}
          onClose={() => setCropOpen(false)}
          onApply={c => { setThumbCrop(c); setCropOpen(false); }} />
      )}
    </section>
  );
}

export default function BoardWritePage() {
  // useSearchParams는 Suspense 경계 필요 (Next App Router)
  return <Suspense fallback={<section className="page" />}><WriteInner /></Suspense>;
}
