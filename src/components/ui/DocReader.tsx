'use client';
// 문서 읽기 화면 — 본문 폭은 갤러리 상세와 같은 672px.
// 왼쪽(모바일에서는 위 ☰ 목차)에 「문서 탭」 목록과, 열려 있는 문서의 제목1·2·3 목차 — 누르면 그 자리로 이동한다.
// 권한이 있으면 ✎ 수정으로 이 화면에서 바로 고친다.
import React, { useEffect, useMemo, useState } from 'react';
import { prepareDoc, DocItem, DEFAULT_DOC_SIZE } from '@/lib/docs';
import { KInput, KStep } from '@/components/ui/Kit';
import { RichEditor } from '@/components/ui/RichEditor';
import { DocImport } from '@/components/ui/DocImport';

export interface DocPatch { title: string; subtitle: string; html: string; size: number }

/** 탭 안 본문 — 읽기 화면과 같은 글자·문단 모양 */
export function DocBody({ html, size }: { html: string; size?: number }) {
  const clean = useMemo(() => prepareDoc(html, 'tb').html, [html]);
  if (!html.trim() || html.trim() === '<p></p>') return null;
  return <div className="doc-body" style={{ ['--doc-fs' as string]: `${size ?? DEFAULT_DOC_SIZE}px` }} dangerouslySetInnerHTML={{ __html: clean }} />;
}

/** 「전체 읽기 >」 — 글자만 (오른쪽 정렬, 이탤릭 볼드, 포인트색) */
export function ReadMore({ onOpen }: { onOpen: () => void }) {
  return <button type="button" className="doc-more" onClick={onOpen}>전체 읽기 &gt;</button>;
}

export function DocReader({ docs, activeId, onPick, bodyFont, canEdit, onSave }: {
  docs: DocItem[];
  activeId: string;
  onPick: (id: string) => void;
  bodyFont?: string;
  canEdit?: boolean;
  onSave?: (id: string, patch: DocPatch) => void;
}) {
  const cur = docs.find(d => d.id === activeId) ?? docs[0];
  const prep = useMemo(() => (cur ? prepareDoc(cur.html, `d${cur.id}`) : { html: '', toc: [] }), [cur]);
  const [open, setOpen] = useState(false);   // 모바일 목차 펼침
  const [draft, setDraft] = useState<DocPatch | null>(null);   // 수정 중인 내용

  // 다른 문서로 가면 수정 모드 종료
  useEffect(() => { setDraft(null); }, [cur?.id]);

  if (!cur) return <div className="panel" style={{ textAlign: 'center', padding: 40, color: 'var(--faint)' }}>읽을 문서가 없습니다</div>;

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpen(false);
  };
  const top = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); document.getElementById('appMain')?.scrollTo({ top: 0, behavior: 'smooth' }); setOpen(false); };
  const size = cur.size ?? DEFAULT_DOC_SIZE;

  return (
    <div className="doc-read">
      <button type="button" className="doc-toc-btn" onClick={() => setOpen(o => !o)}>☰ 목차 · 문서 탭</button>
      <aside className={`doc-side ${open ? 'open' : ''}`}>
        {docs.length > 1 && <div className="doc-side-h">문서 탭</div>}
        {docs.map(d => (
          <div key={d.id}>
            <button type="button" className={`doc-tab ${d.id === cur.id ? 'on' : ''}`}
              onClick={() => { if (d.id !== cur.id) { onPick(d.id); setOpen(false); document.getElementById('appMain')?.scrollTo({ top: 0 }); } else top(); }}>
              <span className="ic">{d.icon}</span><span className="tt">{d.title || '제목 없음'}</span>
            </button>
            {d.id === cur.id && !draft && prep.toc.map(t => (
              <button key={t.id} type="button" className={`doc-toc l${t.level}`} onClick={() => jump(t.id)}>{t.text}</button>
            ))}
          </div>
        ))}
      </aside>

      <article className="panel doc-main" style={bodyFont ? { fontFamily: bodyFont } : undefined}>
        {draft ? (
          <div style={{ display: 'grid', gap: 10 }}>
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
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDraft(null)}>CANCEL</button>
              <button className="btn btn-accent" onClick={() => { onSave?.(cur.id, draft); setDraft(null); }}>SAVE</button>
            </div>
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
            </div>
            <div className="doc-body" dangerouslySetInnerHTML={{ __html: prep.html }} />
          </div>
        )}
      </article>
    </div>
  );
}
