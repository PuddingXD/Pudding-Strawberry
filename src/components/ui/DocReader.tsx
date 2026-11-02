'use client';
// 문서 읽기 화면 — 본문 폭은 갤러리 상세와 같은 672px.
// 왼쪽(모바일에서는 위 ☰ 목차)에 「문서 탭」 목록과, 열려 있는 문서의 제목1·2·3 목차 — 누르면 그 자리로 이동한다.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { prepareDoc, DocItem } from '@/lib/docs';

export function DocReader({ docs, activeId, onPick, bodyFont }: {
  docs: DocItem[];
  activeId: string;
  onPick: (id: string) => void;
  bodyFont?: string;
}) {
  const cur = docs.find(d => d.id === activeId) ?? docs[0];
  const prep = useMemo(() => (cur ? prepareDoc(cur.html, `d${cur.id}`) : { html: '', toc: [] }), [cur]);
  const [open, setOpen] = useState(false);   // 모바일 목차 펼침

  if (!cur) return <div className="panel" style={{ textAlign: 'center', padding: 40, color: 'var(--faint)' }}>읽을 문서가 없습니다</div>;

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpen(false);
  };
  const top = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); setOpen(false); };

  return (
    <div className="doc-read">
      <button type="button" className="doc-toc-btn" onClick={() => setOpen(o => !o)}>☰ 목차 · 문서 탭</button>
      <aside className={`doc-side ${open ? 'open' : ''}`}>
        {docs.length > 1 && <div className="doc-side-h">문서 탭</div>}
        {docs.map(d => (
          <div key={d.id}>
            <button type="button" className={`doc-tab ${d.id === cur.id ? 'on' : ''}`}
              onClick={() => { if (d.id !== cur.id) { onPick(d.id); setOpen(false); window.scrollTo({ top: 0 }); } else top(); }}>
              <span className="ic">{d.icon}</span><span className="tt">{d.title || '제목 없음'}</span>
            </button>
            {d.id === cur.id && prep.toc.map(t => (
              <button key={t.id} type="button" className={`doc-toc l${t.level}`} onClick={() => jump(t.id)}>{t.text}</button>
            ))}
          </div>
        ))}
      </aside>

      <article className="doc-main" style={bodyFont ? { fontFamily: bodyFont } : undefined}>
        <h2 className="doc-title">{cur.title}</h2>
        {cur.subtitle && <div className="doc-sub">{cur.subtitle}</div>}
        <div className="doc-body" dangerouslySetInnerHTML={{ __html: prep.html }} />
      </article>
    </div>
  );
}

/** 탭 안 미리보기 — 몇 문단만 보이고 아래가 흐려지며, 「전체 읽기」로 읽기 화면에 간다 */
export function DocPreview({ html, onOpen }: { html: string; onOpen: () => void }) {
  const clean = useMemo(() => prepareDoc(html, 'pv').html, [html]);
  const ref = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState(false);   // 길어서 잘렸을 때만 아래를 흐리게
  useEffect(() => { const el = ref.current; if (el) setCut(el.scrollHeight > el.clientHeight + 2); }, [clean]);
  if (!html.trim()) return null;
  return (
    <div className="doc-preview-wrap">
      <div ref={ref} className={`prose doc-preview ${cut ? 'cut' : ''}`} dangerouslySetInnerHTML={{ __html: clean }} />
      <button type="button" className="btn btn-dark doc-open" onClick={onOpen}>전체 읽기 ›</button>
    </div>
  );
}
