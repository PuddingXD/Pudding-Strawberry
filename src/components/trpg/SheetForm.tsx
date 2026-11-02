'use client';
// 시트 게시판 입력 폼 — With(말머리) · Name(시트 이름) · Url(시트 링크)
// 말머리는 환경설정 > 게시판 관리에서 정한 것 중에서 고른다
import React, { useState } from 'react';
import { PlayRecord } from '@/lib/galleryStore';
import { SheetFormValue, httpOk } from '@/lib/sheetStore';
import { KInput } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { CatPick } from '@/components/ui/CatPick';
import { useBoardSettings, sheetCatsOf } from '@/lib/boardStore';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="k-label" style={{ marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

export function SheetForm({ initial, secId, onSave, onCancel }: {
  initial: PlayRecord | null;
  secId: string;                     // 어느 시트 게시판인지 — 그 게시판의 말머리 목록을 쓴다
  onSave: (v: SheetFormValue) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const isNew = !initial;
  const [head, setHead] = useState(initial?.withText ?? '');
  const [name, setName] = useState(initial?.scenario ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');

  const { st } = useBoardSettings();   // 말머리는 환경설정 > 게시판 관리에서 정한 것 중에서 고른다
  const cats = sheetCatsOf(st, secId);

  const save = () => {
    if (!name.trim()) { toast('Name을 입력해 주세요'); return; }
    if (!url.trim()) { toast('Url을 입력해 주세요'); return; }
    if (!httpOk(url)) { toast('Url은 http:// 또는 https:// 로 시작해야 합니다'); return; }
    onSave({ head: head.trim(), name: name.trim(), url: url.trim() });
  };

  return (
    <div className="write-grid">
      <div className="panel" style={{ padding: 24, display: 'grid', gap: 12, alignContent: 'start' }}>
        <Field label="With (말머리)"><CatPick cats={cats} value={head} onChange={setHead} /></Field>
        <Field label="Name (시트 이름)"><KInput value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Url (시트 링크)"><KInput value={url} onChange={e => setUrl(e.target.value)} /></Field>
        <p className="hint" style={{ margin: 0 }}>새 시트는 표 맨 위에 추가됩니다 · 말머리를 고르지 않으면 ALL에만 보입니다</p>
      </div>

      <div>
        <div className="form-actions">
          <button className="btn btn-onbk" onClick={onCancel}>CANCEL</button>
          <button className="btn btn-accent" onClick={save}>{isNew ? 'ADD' : 'SAVE'}</button>
        </div>
      </div>
    </div>
  );
}
