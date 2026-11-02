'use client';
// 타임라인 PNG 내보내기 설정창 — 옅은 테마색 배경 + 둥근 카드 위에 타임라인을 얹어 저장한다
//  · 스티커 포함 여부 · 가운데 제목 · 배경 진하기
//  · 헤더 이미지: 없음 / 이 자관 헤더 이미지 / 새 파일 선택 — 높이·확대·위치 조절 (미리보기는 실제 내보내기와 같은 그리기 함수)
import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useBlobUrl } from '@/lib/blobStore';
import { exportTimelinePng, drawCover, loadImg, type PngOpts } from '@/lib/timelinePng';

type Src = 'none' | 'au' | 'file';
const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '88px 1fr 46px', alignItems: 'center', gap: 8, fontSize: 12, margin: '6px 0' };
function Slider({ label, v, set, min, max, step, fmt }: { label: string; v: number; set: (n: number) => void; min: number; max: number; step: number; fmt: (n: number) => string }) {
  return (
    <div style={row}><span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={e => set(parseFloat(e.target.value))} />
      <span style={{ textAlign: 'right', opacity: .7 }}>{fmt(v)}</span></div>
  );
}

export function TimelineExportModal({ open, onClose, filename, getList, base, auHeaderId, hasStickers }: {
  open: boolean; onClose: () => void; filename: string;
  getList: () => HTMLElement | null;
  base: Pick<PngOpts, 'left' | 'right' | 'theme' | 'legend'>;
  auHeaderId?: string;          // 이 자관(AU) 페이지의 헤더 이미지
  hasStickers: boolean;
}) {
  const toast = useToast();
  const auUrl = useBlobUrl(auHeaderId);
  const [title, setTitle] = useState('MEMORY');
  const [stickers, setStickers] = useState(true);
  const [bgStrength, setBgStrength] = useState(0.3);
  const [src, setSrc] = useState<Src>('none');
  const [fileUrl, setFileUrl] = useState<string | undefined>();
  const [height, setHeight] = useState(200);
  const [zoom, setZoom] = useState(1);
  const [px, setPx] = useState(0.5);
  const [py, setPy] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const prev = useRef<HTMLCanvasElement>(null);
  const inited = useRef(false);

  // 처음 열 때: 이 자관에 헤더 이미지가 있으면 그걸 기본으로
  useEffect(() => {
    if (!open) { inited.current = false; return; }
    if (!inited.current && auUrl) { setSrc('au'); inited.current = true; }
  }, [open, auUrl]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const url = src === 'au' ? auUrl : src === 'file' ? fileUrl : undefined;
  const cardW = (() => { const l = getList(); return l ? Math.ceil(l.getBoundingClientRect().width) + 88 : 900; })();

  // 헤더 미리보기
  useEffect(() => {
    const cv = prev.current;
    if (!open || !cv) return;
    let dead = false;
    const PW = 440, k = PW / cardW, PH = Math.max(1, Math.round(height * k));
    cv.width = PW * 2; cv.height = PH * 2;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#f1f2f5'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!url) return;
    void loadImg(url).then(im => {
      if (dead || !im) return;
      drawCover(ctx, im, 0, 0, cv.width, cv.height, zoom, px, py);
    });
    return () => { dead = true; };
  }, [open, url, height, zoom, px, py, cardW]);

  const pick = (f?: File | null) => {
    if (!f || !f.type.startsWith('image/')) return;
    setFileUrl(URL.createObjectURL(f));
    setSrc('file');
  };

  const run = async () => {
    const list = getList();
    if (!list) { toast('타임라인을 찾지 못했습니다'); return; }
    setBusy(true);
    let ok = false;
    try {
      ok = await exportTimelinePng(list, filename, {
        ...base, title: title.trim(), bgStrength, stickers: stickers && hasStickers,
        header: url ? { url, height, zoom, px, py } : undefined,
      });
    } catch { ok = false; }
    finally { setBusy(false); }   // 오류가 나도 버튼이 "만드는 중…"에 갇히지 않게
    toast(ok ? '이미지로 저장했습니다' : '이미지 저장에 실패했습니다 (너무 길면 브라우저가 못 만들 수 있어요)');
    if (ok) onClose();
  };

  const lab: React.CSSProperties = { fontWeight: 600, margin: '14px 0 4px', fontSize: 12.5 };
  return (
    <Modal open={open} onClose={onClose} title="타임라인 PNG 내보내기"
      desc="자관 테마색의 옅은 배경 위에 둥근 카드로 타임라인을 담아 저장합니다."
      actions={<>
        <button className="btn btn-ghost" onClick={onClose}>취소</button>
        <button className="btn btn-dark" disabled={busy} onClick={() => void run()}>{busy ? '만드는 중…' : '⤓ 내보내기'}</button>
      </>}>
      <div style={lab}>가운데 제목</div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="MEMORY (비우면 표시 안 함)" style={{ width: '100%' }} />
      <Slider label="배경 진하기" v={bgStrength} set={setBgStrength} min={0.1} max={0.6} step={0.02} fmt={n => `${Math.round(n * 100)}%`} />

      <div style={lab}>스티커</div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, opacity: hasStickers ? 1 : .5 }}>
        <input type="checkbox" checked={stickers && hasStickers} disabled={!hasStickers} onChange={e => setStickers(e.target.checked)} />
        {hasStickers ? '타임라인 주변의 스티커도 함께 내보내기' : '이 페이지에는 스티커가 없습니다 (PC 화면에서 보입니다)'}
      </label>

      <div style={lab}>헤더 이미지</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className={`btn ${src === 'none' ? 'btn-dark' : 'btn-ghost'}`} style={{ height: 30, fontSize: 11.5 }} onClick={() => setSrc('none')}>없음</button>
        {auUrl && <button className={`btn ${src === 'au' ? 'btn-dark' : 'btn-ghost'}`} style={{ height: 30, fontSize: 11.5 }} onClick={() => setSrc('au')}>이 자관 헤더 이미지</button>}
        <button className={`btn ${src === 'file' ? 'btn-dark' : 'btn-ghost'}`} style={{ height: 30, fontSize: 11.5 }} onClick={() => fileRef.current?.click()}>{fileUrl ? '다른 파일 선택…' : '새 이미지 선택…'}</button>
        {fileUrl && src !== 'file' && <button className="btn btn-ghost" style={{ height: 30, fontSize: 11.5 }} onClick={() => setSrc('file')}>선택한 파일 쓰기</button>}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {url && (
        <>
          <canvas ref={prev} style={{ width: 440, maxWidth: '100%', display: 'block', marginTop: 10, borderRadius: 8, border: '1px solid var(--line,#ddd)' }} />
          <Slider label="높이" v={height} set={setHeight} min={60} max={420} step={5} fmt={n => `${n}px`} />
          <Slider label="확대" v={zoom} set={setZoom} min={1} max={3} step={0.05} fmt={n => `${Math.round(n * 100)}%`} />
          <Slider label="가로 위치" v={px} set={setPx} min={0} max={1} step={0.01} fmt={n => `${Math.round(n * 100)}`} />
          <Slider label="세로 위치" v={py} set={setPy} min={0} max={1} step={0.01} fmt={n => `${Math.round(n * 100)}`} />
        </>
      )}
    </Modal>
  );
}
