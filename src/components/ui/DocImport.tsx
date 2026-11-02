'use client';
// 파일에서 불러오기 — txt · md · html. 현재 본문 뒤에 이어 붙는다.
import React, { useRef, useState } from 'react';
import { fileToHtml } from '@/lib/docs';
import { useToast } from '@/components/ui/Toast';

export function DocImport({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} disabled={busy}
        onClick={() => ref.current?.click()}>{busy ? '불러오는 중…' : '📄 파일에서 불러오기'}</button>
      <input ref={ref} type="file" accept=".txt,.md,.markdown,.html,.htm,text/plain" style={{ display: 'none' }}
        onChange={async e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            const add = await fileToHtml(f);
            onChange((html.trim() && html.trim() !== '<p></p>') ? html + add : add);
            toast('파일을 불러왔습니다 — 아래 본문에서 다듬을 수 있어요');
          } catch (err) {
            toast(err instanceof Error ? err.message : '파일을 불러오지 못했습니다');
          }
          setBusy(false);
        }} />
      <span className="hint" style={{ margin: 0 }}>txt · md · html — 현재 본문 뒤에 이어 붙습니다 (처음부터 바꾸려면 본문을 비우고 불러오세요) · 구글 문서는 파일 &gt; 다운로드 &gt; Markdown(.md)이면 제목1·2·3이 그대로 옵니다</span>
    </div>
  );
}
