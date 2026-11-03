'use client';
// 역극 방에 마스토돈 타래 백업 불러오기 (사용자 요청 — 「마스토돈에서 했던 역극을 RP 방에 대화처럼 백업」).
// 백업 파일(JSON·HTML)을 읽어 발화자마다 이 방의 캐릭터 / 지문 / 빼기를 정하면, 방의 발화로 그대로 들어간다.
// 서식(굵게·기울임·취소선)은 마크다운으로 바뀌어 들어가 방에서 그대로 보이고, 줄바꿈도 유지된다 (lib/mastodonLog).
import React, { useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { KSelect, KRadio } from '@/components/ui/Kit';
import { parseMastodonLog, type MastoParsed } from '@/lib/mastodonLog';
import { guessChar } from '@/lib/discordLog';
import { useToast } from '@/components/ui/Toast';
import type { Character } from '@/lib/charStore';

export interface ImportedMsg { kind: 'char' | 'desc'; charId?: string; text: string; date: string }

export function MastodonImport({ open, onClose, chars, hasMsgs, onImport }: {
  open: boolean; onClose: () => void;
  /** 고를 수 있는 캐릭터 — 방의 자관 멤버(양쪽 모두), 자관이 없으면 전체 */
  chars: Character[];
  /** 방에 이미 대화가 있는지 — 있으면 기본으로 「맨 뒤에 이어서」 */
  hasMsgs: boolean;
  onImport: (msgs: ImportedMsg[], keepTime: boolean) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<MastoParsed | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});   // 발화자 → 캐릭터 id | 'desc' | 'skip'
  const [when, setWhen] = useState<'keep' | 'append'>(hasMsgs ? 'append' : 'keep');

  const load = (raw: string) => {
    const p = parseMastodonLog(raw);
    if (!p || !p.messages.length) { toast('마스토돈 타래 백업(JSON·HTML) 형식을 찾지 못했습니다'); return; }
    // 이름이 같은 캐릭터는 자동으로, 아니면 아직 안 정함
    const m: Record<string, string> = {};
    p.speakers.forEach(s => { m[s.name] = guessChar(s.name, chars)?.id ?? ''; });
    setMap(m); setParsed(p); setWhen(hasMsgs ? 'append' : 'keep');
  };

  const options = useMemo(() => [
    { value: '', label: '— 고르기 —' },
    ...chars.map(c => ({ value: c.id, label: c.name })),
    { value: 'desc', label: '가운데 지문' },
    { value: 'skip', label: '빼기' },
  ], [chars]);

  const close = () => { setParsed(null); onClose(); };
  const apply = () => {
    if (!parsed) return;
    const left = parsed.speakers.filter(s => !map[s.name]);
    if (left.length) { toast(`아직 정하지 않은 발화자가 있습니다: ${left.map(s => s.name).join(', ')}`); return; }
    const msgs: ImportedMsg[] = [];
    for (const m of parsed.messages) {
      const to = map[m.speaker];
      if (!to || to === 'skip') continue;
      msgs.push(to === 'desc' ? { kind: 'desc', text: m.text, date: m.date } : { kind: 'char', charId: to, text: m.text, date: m.date });
    }
    if (!msgs.length) { toast('넣을 대사가 없습니다'); return; }
    onImport(msgs, when === 'keep');
    close();
  };

  return (
    <Modal open={open} onClose={close} title="마스토돈 타래 불러오기"
      desc="「마스토돈 타래 백업」으로 받은 JSON 또는 HTML 파일 — 발화자마다 이 방의 캐릭터를 정하면 대사로 들어갑니다 (넣은 뒤에도 하나씩 수정·삭제 가능)"
      actions={<>
        <button className="btn btn-ghost" onClick={close}>CANCEL</button>
        {parsed && <button className="btn btn-dark" onClick={apply}>불러오기</button>}
      </>}>
      <input ref={fileRef} type="file" accept=".json,.html,.htm,application/json,text/html" hidden onChange={async e => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (f) load(await f.text());
      }} />
      {!parsed ? (
        <div className="upzone" style={{ marginBottom: 0, cursor: 'var(--cur-pointer,pointer)' }} onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={async e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) load(await f.text()); }}>
          <b style={{ display: 'block', marginBottom: 3 }}>백업 파일(.json / .html)을 끌어다 놓거나 클릭</b>
          굵게·기울임 같은 서식과 줄바꿈은 그대로 살아납니다
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <p className="hint" style={{ margin: 0 }}>
            {parsed.title && <>「{parsed.title}」 · </>}대사 {parsed.messages.length}개 · 발화자 {parsed.speakers.length}명
            <button className="btn btn-ghost" style={{ height: 24, padding: '0 10px', fontSize: 10.5, marginLeft: 8 }} onClick={() => fileRef.current?.click()}>다른 파일</button>
          </p>
          {parsed.speakers.map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {parsed.avatars[s.name] && <img src={parsed.avatars[s.name]} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />}
              <b style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{s.name} <small style={{ color: 'var(--faint)', fontWeight: 400 }}>{s.count}개</small></b>
              <KSelect value={map[s.name] ?? ''} minWidth={170} options={options}
                onChange={v => setMap(m => ({ ...m, [s.name]: v }))} />
            </div>
          ))}
          {chars.length === 0 && <p className="hint" style={{ margin: 0 }}>이 방에서 고를 수 있는 캐릭터가 없습니다 — 자관에 캐릭터를 연결하거나 「지문」으로 넣어 주세요</p>}
          <div style={{ borderTop: '1px solid var(--line)', margin: '2px 0' }} />
          <div style={{ display: 'grid', gap: 7 }}>
            <KRadio name="mt-when" value="append" current={when} onChange={v => setWhen(v as 'append')} label="지금 대화 맨 뒤에 이어서" />
            <KRadio name="mt-when" value="keep" current={when} onChange={v => setWhen(v as 'keep')} label="툿을 쓴 시각 그대로 (방의 다른 대화와 시간순으로 섞임)" />
          </div>
        </div>
      )}
    </Modal>
  );
}
