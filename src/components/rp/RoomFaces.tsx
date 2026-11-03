'use client';
// 역극 방 프로필 사진 바꾸기 (사용자 요청 — 「연결된 이미지 말고 임의로 다른 프로필 이미지」).
// 이 방에서만 쓰는 사진이라 캐릭터 프로필 자체는 그대로다. 「원래대로」를 누르면 다시 캐릭터 사진.
import React, { useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { BlobImg, putBlob } from '@/lib/blobStore';
import { CroppedBlobImg, type CropValue } from '@/components/ui/CropEditor';
import { useToast } from '@/components/ui/Toast';
import type { Character } from '@/lib/charStore';

export function RoomFaces({ chars, faces, cropOf, onChange, onClose }: {
  chars: Character[];
  faces: Record<string, string>;
  cropOf: (c: Character) => CropValue | undefined;
  onChange: (faces: Record<string, string>) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (id: string) => { setTarget(id); fileRef.current?.click(); };
  const reset = (id: string) => { const n = { ...faces }; delete n[id]; onChange(n); };

  return (
    <Modal open onClose={onClose} title="이 방의 프로필 사진"
      desc="이 방에서만 쓰는 사진입니다 — 캐릭터 프로필은 바뀌지 않아요. 정사각형에 가까운 그림이 잘 맞습니다"
      actions={<button className="btn btn-dark" onClick={onClose}>DONE</button>}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={async e => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f || !target) return;
        if (!f.type.startsWith('image/')) { toast('그림 파일만 올릴 수 있습니다'); return; }
        setBusy(true);
        try { const id = await putBlob(f); onChange({ ...faces, [target]: id }); }
        catch { toast('사진을 올리지 못했습니다'); }
        finally { setBusy(false); setTarget(null); }
      }} />
      <div className="rp-face-list">
        {chars.map(c => (
          <div key={c.id} className="rp-face-row">
            <span className="f">
              {faces[c.id]
                ? <BlobImg fileRef={faces[c.id]} ph="" label="" />
                : <CroppedBlobImg fileRef={c.thumbId} crop={cropOf(c)} ph="" />}
            </span>
            <b>{c.name}{faces[c.id] && <small>이 방 전용</small>}</b>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }} disabled={busy}
              onClick={() => pick(c.id)}>{busy && target === c.id ? '…' : 'CHANGE'}</button>
            {faces[c.id] && <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
              onClick={() => reset(c.id)}>원래대로</button>}
          </div>
        ))}
        {chars.length === 0 && <p className="hint" style={{ margin: 0 }}>이 방에 연결된 캐릭터가 없습니다</p>}
      </div>
    </Modal>
  );
}
