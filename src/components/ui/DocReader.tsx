'use client';
// 문서 읽기 화면 — 본문 폭은 갤러리 상세와 같은 672px.
// 왼쪽(모바일에서는 위 ☰ 목차)에 「문서 탭」 목록과, 열려 있는 문서의 제목1·2·3 목차 — 누르면 그 자리로 이동한다.
// 권한이 있으면 ✎ 수정으로 이 화면에서 바로 고친다.
import React, { useEffect, useMemo, useState } from 'react';
import { prepareDoc, DocItem, DEFAULT_DOC_SIZE, DEFAULT_TAB_SIZE } from '@/lib/docs';
import { KInput, KStep } from '@/components/ui/Kit';
import { RichEditor } from '@/components/ui/RichEditor';
import { DocImport } from '@/components/ui/DocImport';
import { DragList } from '@/components/ui/DragList';
import { NavLink } from '@/components/ui/NavLink';
import { useConfirmDelete } from '@/components/ui/Modal';

export interface DocPatch { title: string; subtitle: string; html: string; size: number }

/** 탭 안 본문 — 읽기 화면과 같은 글자·문단 모양 */
export function DocBody({ html, size, flat }: { html: string; size?: number; flat?: boolean }) {
  const clean = useMemo(() => prepareDoc(html, 'tb').html, [html]);
  if (!html.trim() || html.trim() === '<p></p>') return null;
  return <div className={flat ? 'doc-body doc-flat' : 'doc-body'} style={{ ['--doc-fs' as string]: `${size ?? DEFAULT_TAB_SIZE}px` }} dangerouslySetInnerHTML={{ __html: clean }} />;
}

/** 「전체 읽기 >」 — 글자만 (오른쪽 정렬, 이탤릭 볼드, 포인트색) */
export function ReadMore({ onOpen, href }: { onOpen: () => void; href?: string }) {
  if (href) return <NavLink className="doc-more" href={href} onGo={onOpen}>전체 읽기 &gt;</NavLink>;
  return <button type="button" className="doc-more" onClick={onOpen}>전체 읽기 &gt;</button>;
}

export function DocReader({ docs, activeId, onPick, bodyFont, canEdit, onSave, onDelete, deleteNote, onAdd, onReorder, startEditId, onStartedEdit }: {
  docs: DocItem[];
  activeId: string;
  onPick: (id: string) => void;
  bodyFont?: string;
  canEdit?: boolean;
  onSave?: (id: string, patch: DocPatch) => void;
  onDelete?: (id: string) => void;     // 「삭제」 — 확인창을 거친 뒤 부른다 (없으면 삭제 버튼 없음)
  deleteNote?: string;                 // 삭제 확인창에 덧붙일 안내
  onAdd?: () => void;                  // 「＋ 문서 추가」 (자관) — 없으면 버튼 없음
  onReorder?: (ids: string[]) => void; // 문서 제목을 끌어 순서 변경 (권한 있을 때만) — 프로필/자관 페이지의 아이콘 순서도 같이 바뀐다
  startEditId?: string;                // 이 문서가 열리면 바로 수정 모드로 (방금 추가한 문서)
  onStartedEdit?: () => void;
}) {
  const cur = docs.find(d => d.id === activeId) ?? docs[0];
  const prep = useMemo(() => (cur ? prepareDoc(cur.html, `d${cur.id}`) : { html: '', toc: [] }), [cur]);
  const [open, setOpen] = useState(false);   // 모바일 목차 펼침
  const [draft, setDraft] = useState<DocPatch | null>(null);   // 수정 중인 내용
  const [tocOpen, setTocOpen] = useState(true);                 // 문서 제목 아래 소제목(목차) 펼침 — 제목을 누르면 접고 펼친다
  const del = useConfirmDelete();

  // 단축키 A·D(또는 ←·→) = 이전·다음 문서 (PC 전용, 수정 중·입력 중·팝업이 떠 있을 땐 제외) — W(문서 추가)·E(수정)·X(삭제)는 공용 단축키가 버튼을 눌러 준다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (draft || !cur) return;
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing || e.repeat) return;
      const dir = e.code === 'KeyA' || e.key === 'ArrowLeft' ? -1 : e.code === 'KeyD' || e.key === 'ArrowRight' ? 1 : 0;
      if (!dir) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[role="dialog"], .modal-ov')) return;
      const go = docs[docs.findIndex(d => d.id === cur.id) + dir];
      if (!go) return;
      e.preventDefault();
      onPick(go.id);
      document.getElementById('appMain')?.scrollTo({ top: 0 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { setTocOpen(true); }, [activeId]);

  // 다른 문서로 가면 수정 모드 종료 — 방금 추가한 문서면 바로 수정 모드로
  useEffect(() => {
    if (cur && startEditId && cur.id === startEditId) {
      setDraft({ title: cur.title, subtitle: cur.subtitle ?? '', html: cur.html, size: cur.size ?? DEFAULT_DOC_SIZE });
      onStartedEdit?.();
    } else setDraft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id, startEditId]);

  if (!cur) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 40, color: 'var(--faint)' }}>
        읽을 문서가 없습니다
        {canEdit && onAdd && <div style={{ marginTop: 14 }}><button type="button" className="btn btn-dark" onClick={onAdd}>＋ 문서 추가</button></div>}
      </div>
    );
  }

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpen(false);
  };
  const size = cur.size ?? DEFAULT_DOC_SIZE;

  return (
    <div className="doc-read">
      <button type="button" className="doc-toc-btn" onClick={() => setOpen(o => !o)}>☰ 목차 · 문서 탭</button>
      <aside className={`doc-side ${open ? 'open' : ''}`}>
        {docs.length > 1 && <div className="doc-side-h">문서 탭</div>}
        <DragList items={docs} keyOf={d => d.id} disabled={!canEdit || !onReorder || docs.length < 2}
          onReorder={next => onReorder?.(next.map(d => d.id))}
          render={d => {
            const isCur = d.id === cur.id;
            const hasToc = isCur && !draft && prep.toc.length > 0;
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {canEdit && onReorder && docs.length > 1 && <span className="drag-h" data-tip="끌어서 순서 변경" style={{ padding: '0 2px 0 4px', flexShrink: 0 }}>⠿</span>}
                  <button type="button" className={`doc-tab ${isCur ? 'on' : ''}`} style={{ flex: 1, minWidth: 0 }}
                    onClick={() => {
                      // 다른 문서 → 그 문서로 / 지금 열린 문서 → 소제목 접기·펼치기
                      if (!isCur) { onPick(d.id); setOpen(false); document.getElementById('appMain')?.scrollTo({ top: 0 }); }
                      else setTocOpen(o => !o);
                    }}>
                    <span className="ic">{d.icon}</span><span className="tt">{d.title || '제목 없음'}</span>
                    {hasToc && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: .55, flexShrink: 0 }}>{tocOpen ? '▾' : '▸'}</span>}
                  </button>
                </div>
                {hasToc && tocOpen && prep.toc.map(t => (
                  <button key={t.id} type="button" className={`doc-toc l${t.level}`} onClick={() => jump(t.id)}>{t.text}</button>
                ))}
              </div>
            );
          }} />
        {canEdit && onAdd && (
          <button type="button" className="doc-tab" style={{ color: 'var(--top-fg, var(--faint))', marginTop: 6 }} onClick={onAdd}>
            <span className="ic">＋</span><span className="tt">문서 추가</span>
          </button>
        )}
      </aside>

      <article className="panel doc-main" style={bodyFont ? { fontFamily: bodyFont } : undefined}>
        {draft ? (
          <div style={{ display: 'grid', gap: 10, ['--re-top' as string]: '46px' }}>
            {/* CANCEL / SAVE — 글이 길어져도 늘 위에 붙어 있다 */}
            <div className="doc-editbar">
              <b style={{ fontSize: 12.5 }}>문서 수정</b>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" style={{ height: 32, padding: '0 14px' }} onClick={() => setDraft(null)}>CANCEL</button>
                <button className="btn btn-accent" style={{ height: 32, padding: '0 14px' }} onClick={() => { onSave?.(cur.id, draft); setDraft(null); }}>SAVE</button>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <KInput placeholder="제목" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              <KInput placeholder="소제목 (선택)" value={draft.subtitle} onChange={e => setDraft({ ...draft, subtitle: e.target.value })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="k-label" style={{ margin: 0 }}>본문 글자 크기</label>
              <KStep value={draft.size} min={8} max={24} step={1} suffix="px" onChange={v => setDraft({ ...draft, size: v })} />
            </div>
            <DocImport html={draft.html} onChange={html => setDraft({ ...draft, html })} />
            <RichEditor doc size={draft.size} value={draft.html} onChange={html => setDraft(d => (d ? { ...d, html } : d))} />
          </div>
        ) : (
          <div style={{ ['--doc-fs' as string]: `${size}px` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="doc-title">{cur.title}</h2>
                {cur.subtitle && <div className="doc-sub">{cur.subtitle}</div>}
              </div>
              {canEdit && (
                <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11, flexShrink: 0 }}
                  onClick={() => setDraft({ title: cur.title, subtitle: cur.subtitle ?? '', html: cur.html, size })}>✎ 수정</button>
              )}
              {canEdit && onDelete && (
                <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11, flexShrink: 0 }}
                  onClick={() => del.ask(`「${cur.title || '제목 없음'}」 문서를 삭제하시겠습니까?`, () => onDelete(cur.id), deleteNote ? `${deleteNote} 삭제하면 복구할 수 없습니다.` : undefined)}>삭제</button>
              )}
            </div>
            <div className="doc-body" dangerouslySetInnerHTML={{ __html: prep.html }} />
          </div>
        )}
      </article>
      {del.element}
    </div>
  );
}
