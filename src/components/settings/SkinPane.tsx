'use client';
// 환경설정 > 효과·입장 화면 (B 디자인에서 가져온 꾸미기) — 저장은 바꾸는 즉시 (lib/skinStore)
import React, { useRef, useState } from 'react';
import { useSkinSettings, FX_SHAPE_LABEL, type FxShape, type SkinSettings } from '@/lib/skinStore';
import { KToggle, KStep, KSelect, KCheck, LiveInput } from '@/components/ui/Kit';
import { ColorField } from '@/components/ui/ColorField';
import { putBlob, useBlobUrl } from '@/lib/blobStore';
import { useToast } from '@/components/ui/Toast';

const SHAPES = (Object.keys(FX_SHAPE_LABEL) as FxShape[]).map(k => ({ value: k, label: FX_SHAPE_LABEL[k] }));

/** 선택 색 — 체크를 끄면 비운 값('') = 자동 */
function OptColor({ value, onChange, autoLabel = '자동' }: { value: string; onChange: (v: string) => void; autoLabel?: string }) {
  const on = !!value;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <KCheck label={on ? '직접 지정' : autoLabel} checked={on} onChange={v => onChange(v ? '#ffffff' : '')} />
      {on && <ColorField value={value} onChange={onChange} />}
    </span>
  );
}

/** 파일 하나 올리기 — 이미지면 작은 미리보기 */
function FilePick({ value, onChange, accept, kind = 'image' }: {
  value: string; onChange: (v: string) => void; accept: string; kind?: 'image' | 'audio';
}) {
  const toast = useToast();
  const url = useBlobUrl(value || undefined);
  const inp = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {kind === 'image' && url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
      )}
      {kind === 'audio' && url && <audio src={url} controls style={{ height: 30, maxWidth: 200 }} />}
      <input ref={inp} type="file" accept={accept} hidden onChange={async e => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        setBusy(true);
        try { onChange(await putBlob(f)); } catch (err) { toast(`올리지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`); }
        setBusy(false);
      }} />
      <button className="btn btn-ghost" style={{ height: 30, padding: '0 12px', fontSize: 11 }} disabled={busy}
        onClick={() => inp.current?.click()}>{busy ? '올리는 중…' : value ? '바꾸기' : '올리기'}</button>
      {value && <button className="btn btn-ghost" style={{ height: 30, padding: '0 12px', fontSize: 11 }} onClick={() => onChange('')}>지우기</button>}
    </span>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <div className="l"><b>{label}</b>{desc && <small>{desc}</small>}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  );
}

export function SkinPane() {
  const [st, patch] = useSkinSettings();
  const L = st.landing, P = st.particles, T = st.trail, C = st.click;
  const pl = (p: Partial<SkinSettings['landing']>) => patch({ landing: { ...L, ...p } });
  const pp = (p: Partial<SkinSettings['particles']>) => patch({ particles: { ...P, ...p } });
  const pt = (p: Partial<SkinSettings['trail']>) => patch({ trail: { ...T, ...p } });
  const pc = (p: Partial<SkinSettings['click']>) => patch({ click: { ...C, ...p } });

  return (
    <>
      <div className="set-sec">
        <h3>왼쪽 메뉴선 색</h3>
        <div className="d">PC 왼쪽 메뉴의 세로선 그라데이션 — 비워 두면 포인트 컬러 → 연한 포인트 → 로고 글씨색으로 자동 (디자인 탭 색을 바꾸면 같이 바뀝니다)</div>
        <Row label="위"><OptColor value={st.railC1} onChange={v => patch({ railC1: v })} /></Row>
        <Row label="가운데"><OptColor value={st.railC2} onChange={v => patch({ railC2: v })} /></Row>
        <Row label="아래"><OptColor value={st.railC3} onChange={v => patch({ railC3: v })} /></Row>
      </div>

      <div className="set-sec">
        <h3>입장 화면</h3>
        <div className="d">메인에 들어오면 화면 전체를 덮는 첫 화면 — 아무 곳이나 누르면 메인으로 들어갑니다 (BGM 자동 재생도 이 클릭으로 풀립니다)</div>
        <Row label="입장 화면 사용"><KToggle checked={L.on} onChange={v => pl({ on: v })} /></Row>
        {L.on && (
          <>
            <Row label="보여 줄 때" desc="끄면 창을 새로 열었을 때 한 번만">
              <KToggle label="메인에 올 때마다" checked={L.every} onChange={v => pl({ every: v })} />
            </Row>
            <Row label="로고 이미지" desc="없으면 사이트 이름(디자인 탭 로고 텍스트)이 글자로 나옵니다">
              <FilePick value={L.logo} onChange={v => pl({ logo: v })} accept="image/*" />
            </Row>
            {L.logo && <Row label="로고 폭"><KStep value={L.logoW} onChange={v => pl({ logoW: v })} min={40} max={2000} step={10} suffix="px" /></Row>}
            <Row label="아래 문구" desc="비우면 문구 없음">
              <LiveInput className="k-input" style={{ width: 220 }} value={L.caption} onValue={v => pl({ caption: v })} placeholder="click to enter" />
            </Row>
            <Row label="배경 이미지"><FilePick value={L.bgImg} onChange={v => pl({ bgImg: v })} accept="image/*" /></Row>
            <Row label="배경색" desc="비우면 페이지 배경 그라데이션 그대로"><OptColor value={L.bgColor} onChange={v => pl({ bgColor: v })} autoLabel="페이지 배경" /></Row>
            {L.bgColor && <Row label="배경 그라데이션 두 번째 색"><OptColor value={L.bgColor2} onChange={v => pl({ bgColor2: v })} autoLabel="없음" /></Row>}
            <Row label="글자색"><OptColor value={L.ink} onChange={v => pl({ ink: v })} autoLabel="페이지 제목색" /></Row>
          </>
        )}
      </div>

      <div className="set-sec">
        <h3>떨어지는 효과</h3>
        <div className="d">화면 뒤쪽에서 천천히 내려오는 장식 — 글·카드 뒤에 깔립니다 (움직임 줄이기를 켠 기기에서는 나오지 않습니다)</div>
        <Row label="사용"><KToggle checked={P.on} onChange={v => pp({ on: v })} /></Row>
        {P.on && (
          <>
            <Row label="모양"><KSelect options={SHAPES} value={P.shape} onChange={v => pp({ shape: v as FxShape })} /></Row>
            <Row label="색"><ColorField value={P.color} onChange={v => pp({ color: v })} /></Row>
            <Row label="개수"><KStep value={P.count} onChange={v => pp({ count: v })} min={5} max={150} step={5} /></Row>
            <Row label="속도"><KStep value={P.speed} onChange={v => pp({ speed: v })} min={1} max={10} /></Row>
            <Row label="크기"><KStep value={P.size} onChange={v => pp({ size: v })} min={2} max={20} suffix="px" /></Row>
          </>
        )}
      </div>

      <div className="set-sec">
        <h3>마우스 효과</h3>
        <div className="d">마우스가 지나간 자리에 조각이 반짝이며 떨어집니다 — PC에서만 (휴대폰은 나오지 않습니다)</div>
        <Row label="사용"><KToggle checked={T.on} onChange={v => pt({ on: v })} /></Row>
        {T.on && (
          <>
            <Row label="모양"><KSelect options={SHAPES} value={T.shape} onChange={v => pt({ shape: v as FxShape })} /></Row>
            <Row label="색"><ColorField value={T.color} onChange={v => pt({ color: v })} /></Row>
            <Row label="두 번째 색" desc="정하면 두 색이 섞여 나옵니다"><OptColor value={T.color2} onChange={v => pt({ color2: v })} autoLabel="없음" /></Row>
            <Row label="크기"><KStep value={T.size} onChange={v => pt({ size: v })} min={4} max={30} suffix="px" /></Row>
            <Row label="양"><KStep value={T.amount} onChange={v => pt({ amount: v })} min={1} max={10} /></Row>
            <Row label="머무는 시간"><KStep value={T.life} onChange={v => pt({ life: v })} min={1} max={10} /></Row>
          </>
        )}
      </div>

      <div className="set-sec">
        <h3>클릭 효과음</h3>
        <div className="d">사이트 어디를 누르든 짧은 소리 — 파일을 올리지 않으면 기본 &quot;톡&quot; 소리</div>
        <Row label="사용"><KToggle checked={C.on} onChange={v => pc({ on: v })} /></Row>
        {C.on && (
          <>
            <Row label="소리 파일" desc="mp3·wav·ogg — 아주 짧은 소리 권장">
              <FilePick value={C.file} onChange={v => pc({ file: v })} accept="audio/*" kind="audio" />
            </Row>
            <Row label="크기"><KStep value={C.volume} onChange={v => pc({ volume: v })} min={1} max={100} step={5} suffix="%" /></Row>
          </>
        )}
      </div>
    </>
  );
}
