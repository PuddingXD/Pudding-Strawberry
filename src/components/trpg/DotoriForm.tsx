'use client';
// 도토리 등록/수정 공용 폼 (4.15) — 16:9 이미지 + 시나리오 정보 + 상태
import React, { useState } from 'react';
import { DotoriItem, DotoriLink, DOTORI_LINK_MAX, DotoriStatus, dotoriStatusKeys, dotoriStatusOf, useTrpgSettings } from '@/lib/galleryStore';
import { normalizeInternalLink } from '@/lib/link';
import { KInput, KSelect } from '@/components/ui/Kit';
import { DragList } from '@/components/ui/DragList';
import { CropEditor, CropValue, CropImg, CroppedBlobImg } from '@/components/ui/CropEditor';
import { putBlob } from '@/lib/blobStore';
import { useToast } from '@/components/ui/Toast';

const RULE_OPTS = ['CoC', 'inSANe', '기타'];
const PEOPLE_OPTS = ['타이만', '1인', '2인', '기타'];
/** 고정 선택지 + (예전 글에 직접 적어 둔 값이 있으면 그 값도 선택지로 남겨 사라지지 않게) */
const optsWith = (base: string[], cur: string) => (cur && !base.includes(cur) ? [cur, ...base] : base).map(v => ({ value: v, label: v }));

export interface DotoriFormValue {
  name: string; writer: string; rule: string; people: string;
  tags: string[]; link?: string; links?: DotoriLink[]; status: DotoriStatus;
  imgId?: string; thumbCrop?: CropValue;
}

export function DotoriForm({ initial, onSave, onCancel }: {
  initial: DotoriItem | null;
  onSave: (v: DotoriFormValue) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [trpgSet] = useTrpgSettings(); // 상태 라벨 (환경설정 > TRPG)
  const isNew = !initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [writer, setWriter] = useState(initial?.writer ?? '');
  const [rule, setRule] = useState(initial?.rule ?? '');
  const [people, setPeople] = useState(initial?.people ?? '');
  const [link, setLink] = useState(initial?.link ?? '');
  // 추가 링크 (세팅 배포용 등) — ＋로 늘려 최대 10개, 각각 짧은 제목
  const [links, setLinks] = useState<DotoriLink[]>(initial?.links ?? []);
  const patchLink = (id: string, p: Partial<DotoriLink>) => setLinks(l => l.map(x => (x.id === id ? { ...x, ...p } : x)));
  // 새로 담는 시나리오는 대개 아직 일정이 없다 — 기본값을 「일정 미정」으로 (사용자 확정)
  const [status, setStatus] = useState<DotoriStatus>(initial?.status ?? 'undecided');
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [removed, setRemoved] = useState(false);
  const [crop, setCrop] = useState<CropValue | undefined>(initial?.thumbCrop);
  const [cropOpen, setCropOpen] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast('시나리오 이름을 입력해 주세요'); return; }
    onSave({
      name: name.trim(), writer: writer.trim(), rule: rule.trim(), people: people.trim(),
      tags: initial?.tags ?? [],   // 태그 입력은 없앴다 — 예전 글의 값만 그대로 보존
      link: link.trim() || undefined, status,
      // 주소가 빈 줄은 버린다 — 제목만 있으면 어디로 갈지 모르므로 (풀주소는 사이트 안 주소로 정리)
      links: links.map(x => ({ ...x, title: x.title.trim(), url: normalizeInternalLink(x.url) })).filter(x => x.url).length
        ? links.map(x => ({ ...x, title: x.title.trim(), url: normalizeInternalLink(x.url) })).filter(x => x.url) : undefined,
      imgId: file ? await putBlob(file) : (removed ? undefined : initial?.imgId),
      thumbCrop: crop,
    });
  };

  return (
    <div className="write-grid">
      {/* 좌: 이미지 */}
      <div className="panel" style={{ padding: 24, display: 'grid', gap: 12, alignContent: 'start' }}>
        <label className="k-label" style={{ margin: 0 }}>
          이미지 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— 카드 썸네일 16:9 · 원본은 잘리지 않음 (선택)</span>
        </label>
        <div style={{ aspectRatio: '16/9', borderRadius: 9, overflow: 'hidden', position: 'relative', border: '1.5px dashed var(--line)', cursor: 'var(--cur-pointer,pointer)' }} onClick={() => document.getElementById('dtImgF')?.click()}>
          {fileUrl
            ? <CropImg src={fileUrl} crop={crop} />
            : (!removed && initial?.imgId)
              ? <CroppedBlobImg fileRef={initial.imgId} crop={crop} ph="" />
              : <div className="ph" style={{ position: 'absolute', inset: 0 }}><span style={{ fontSize: 10 }}>SCENARIO</span></div>}
        </div>
        <input id="dtImgF" type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setFileUrl(URL.createObjectURL(f)); setRemoved(false); setCrop(undefined); setCropOpen(true); }
            e.target.value = '';
          }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {(fileUrl || (!removed && initial?.imgId)) && (
            <>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                onClick={() => setCropOpen(true)}>✂ 썸네일 위치</button>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                onClick={() => { setFile(null); setFileUrl(''); setRemoved(true); setCrop(undefined); }}>이미지 제거</button>
            </>
          )}
        </div>
      </div>

      {/* 우: 정보 + 저장 */}
      <div>
        <div className="panel widget" style={{ marginBottom: 14 }}>
          <h4>시나리오</h4>
          <div style={{ display: 'grid', gap: 9 }}>
            <KInput placeholder="시나리오 이름" value={name} onChange={e => setName(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <KInput placeholder="라이터" value={writer} onChange={e => setWriter(e.target.value)} />
              <KSelect placeholder="룰" value={rule} onChange={setRule} options={optsWith(RULE_OPTS, rule)} minWidth={100} />
              <KSelect placeholder="인원" value={people} onChange={setPeople} options={optsWith(PEOPLE_OPTS, people)} minWidth={90} />
            </div>
            <KInput placeholder="링크 (선택)" value={link} onChange={e => setLink(e.target.value)} />
            {/* 추가 링크 — 세팅 배포용 등. ＋로 늘리고 줄마다 "무슨 링크인지" 짧은 제목 */}
            <div style={{ display: 'grid', gap: 7, padding: '2px 0' }}>
              <label className="k-label" style={{ margin: 0 }}>
                추가 링크
              </label>
              {/* ⠿ 손잡이를 끌어 순서 변경 — 카드 칩 순서도 이 순서대로 */}
              <DragList items={links} keyOf={l => l.id} onReorder={setLinks} render={l => (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', padding: '3px 0' }}>
                  <span className="drag-h" data-tip="끌어서 순서 변경">⠿</span>
                  <KInput maxLength={20} value={l.title} onChange={e => patchLink(l.id, { title: e.target.value })} style={{ maxWidth: 150 }} />
                  <KInput value={l.url} onChange={e => patchLink(l.id, { url: e.target.value })} />
                  <span className="fx" data-tip="이 링크 빼기" onClick={() => setLinks(x => x.filter(y => y.id !== l.id))}>✕</span>
                </div>
              )} />
              {links.length < DOTORI_LINK_MAX && (
                <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11, justifySelf: 'start' }}
                  onClick={() => setLinks(x => [...x, { id: `l${Date.now().toString(36)}${x.length}`, title: '', url: '' }])}>＋ 링크 추가</button>
              )}
            </div>
            <KSelect value={status} onChange={v => setStatus(v as DotoriStatus)}
              options={dotoriStatusKeys(trpgSet).map(s => ({ value: s, label: dotoriStatusOf(trpgSet, s).label }))} />
            <p className="hint" style={{ margin: 0 }}>뱃지는 공수표·일정 확정만 카드에 표시 — 완은 완 탭에서만 보입니다</p>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-onbk" onClick={onCancel}>CANCEL</button>
          <button className="btn btn-accent" onClick={save}>
            {isNew ? 'ADD' : 'SAVE'}
          </button>
        </div>
      </div>

      {cropOpen && (fileUrl || initial?.imgId) && (
        <DtCrop src={fileUrl} refId={!fileUrl ? initial?.imgId : undefined} crop={crop}
          onClose={() => setCropOpen(false)}
          onApply={c => { setCrop(c); setCropOpen(false); }} />
      )}
    </div>
  );
}

/** 새 파일(objectURL) 또는 저장 블롭을 소스로 16:9 크롭 */
import { useBlobUrl } from '@/lib/blobStore';
function DtCrop({ src, refId, crop, onClose, onApply }: {
  src: string; refId?: string; crop?: CropValue; onClose: () => void; onApply: (c: CropValue) => void;
}) {
  const loaded = useBlobUrl(refId);
  const s = src || loaded;
  if (!s) return null;
  return <CropEditor open src={s} aspect="16:9" initial={crop} onClose={onClose} onApply={onApply} />;
}
