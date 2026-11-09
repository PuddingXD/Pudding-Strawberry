'use client';
// 목록 카드의 이미지 우클릭 → 「썸네일 수정」 (사용자 요청) — 이미지 위에서만 이 메뉴가 뜨고,
// 이름·제목 위에서는 브라우저 기본 메뉴(새 탭/새 창/시크릿 창에서 열기)가 그대로 뜬다.
// 갤러리·리뷰 목록의 썸네일 수정과 같은 순서: 우클릭 → 메뉴 → 항목 → 크롭 화면.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CropEditor, CropValue, CropAspect } from '@/components/ui/CropEditor';
import { useBlobUrl, isVideoRef } from '@/lib/blobStore';

function CropModal({ fileRef, aspect, initial, onClose, onApply }: {
  fileRef: string; aspect: CropAspect; initial?: CropValue; onClose: () => void; onApply: (c: CropValue) => void;
}) {
  const url = useBlobUrl(fileRef);
  if (!url || isVideoRef(fileRef)) return null;   // 영상은 자를 수 없다
  return <CropEditor open src={url} aspect={aspect} initial={initial} onClose={onClose} onApply={onApply} />;
}

export function useThumbEdit<T>(opts: {
  aspect: CropAspect;
  refOf: (t: T) => string | undefined;
  cropOf: (t: T) => CropValue | undefined;
  titleOf: (t: T) => string;
  canEdit: (t: T) => boolean;
  onApply: (t: T, crop: CropValue) => void;
}) {
  const [ctx, setCtx] = useState<{ x: number; y: number; t: T } | null>(null);
  const [crop, setCrop] = useState<T | null>(null);
  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctx]);
  const open = (e: React.MouseEvent, t: T) => {
    if (!opts.canEdit(t) || !opts.refOf(t)) return;   // 권한이 없거나 이미지가 없으면 기본 메뉴
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, t });
  };
  const node = (
    <>
      {ctx && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 130,
          background: 'var(--panel-solid,#fff)', border: '1px solid var(--line)', borderRadius: 9,
          boxShadow: 'var(--sh-dd)', padding: 4, display: 'grid', minWidth: 128,
        }} onMouseDown={e => e.stopPropagation()}>
          <div style={{
            padding: '6px 12px 5px', fontSize: 10.5, color: 'var(--faint)', maxWidth: 200,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            borderBottom: '1px solid var(--line)', marginBottom: 3,
          }}>{opts.titleOf(ctx.t)}</div>
          <button style={{ padding: '7px 12px', fontSize: 12, borderRadius: 6, textAlign: 'left' }}
            onClick={() => { setCrop(ctx.t); setCtx(null); }}>썸네일 수정</button>
        </div>,
        document.body,
      )}
      {crop && opts.refOf(crop) && (
        <CropModal fileRef={opts.refOf(crop)!} aspect={opts.aspect} initial={opts.cropOf(crop)}
          onClose={() => setCrop(null)}
          onApply={c => { opts.onApply(crop, c); setCrop(null); }} />
      )}
    </>
  );
  return { open, node };
}
