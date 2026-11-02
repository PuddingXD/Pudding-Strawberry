'use client';
// 시트 게시판 입력 폼 — With(말머리) · Name(시트 이름) · Date · Url(시트 링크)
// 말머리는 직접 입력하거나, 이미 쓴 말머리를 눌러 고른다
import React, { useState } from 'react';
import { PlayRecord } from '@/lib/galleryStore';
import { SheetFormValue, httpOk } from '@/lib/sheetStore';
import { KInput, KDate } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="k-label" style={{ marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

export function SheetForm({ initial, records, onSave, onCancel }: {
  initial: PlayRecord | null;
  records: PlayRecord[];             // 이 섹션의 시트 — 말머리 후보 소스
  onSave: (v: SheetFormValue) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const isNew = !initial;
  const [head, setHead] = useState(initial?.withText ?? '');
  const [name, setName] = useState(initial?.scenario ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');

  const heads = [...new Set(records.map(r => r.withText.trim()).filter(Boolean))];

  const save = () => {
    if (!name.trim()) { toast('Name을 입력해 주세요'); return; }
    if (!url.trim()) { toast('Url을 입력해 주세요'); return; }
    if (!httpOk(url)) { toast('Url은 http:// 또는 https:// 로 시작해야 합니다'); return; }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('Date는 YYYY-MM-DD 형식으로 입력해 주세요'); return; }
    onSave({ head: head.trim(), name: name.trim(), date: date || undefined, url: url.trim() });
  };

  return (
    <div className="write-grid">
      <div className="panel" style={{ padding: 24, display: 'grid', gap: 12, alignContent: 'start' }}>
        <div>
          <Field label="With (말머리)"><KInput value={head} onChange={e => setHead(e.target.value)} /></Field>
          {heads.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {heads.map(h => (
                <button key={h} type="button" className={`sh-chip ${head.trim() === h ? 'on' : ''}`}
                  onClick={() => setHead(head.trim() === h ? '' : h)}>{h}</button>
              ))}
            </div>
          )}
        </div>
        <Field label="Name (시트 이름)"><KInput value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Date (optional)"><KDate value={date} onChange={setDate} placeholder="" style={{ width: '100%' }} /></Field>
        <Field label="Url (시트 링크)"><KInput value={url} onChange={e => setUrl(e.target.value)} /></Field>
        <p className="hint" style={{ margin: 0 }}>Date를 비워두면 표 맨 아래에 추가됩니다 · 말머리를 비우면 모아보기 탭에는 나오지 않고 ALL에만 보입니다</p>
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
