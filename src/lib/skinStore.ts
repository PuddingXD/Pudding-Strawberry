'use client';
// B 디자인에서 가져온 꾸미기 설정 — 입장 화면 · 떨어지는 효과 · 마우스 효과 · 클릭음 · 왼쪽 메뉴선 색.
// 사이트 설정 한 키(ohome.skin.v1)에 모아 저장한다 (관리자만 쓰기, 방문자 모두 읽기 — 다른 사이트 설정과 같다).
import { useCallback, useEffect, useState } from 'react';
import { getRawSetting, setSetting } from './settingStore';

export type FxShape = 'star' | 'heart' | 'circle' | 'snow' | 'petal' | 'sparkle';

export const FX_SHAPE_LABEL: Record<FxShape, string> = {
  star: '별', heart: '하트', circle: '동그라미', snow: '눈송이', petal: '꽃잎', sparkle: '반짝이',
};

export interface LandingSettings {
  on: boolean;
  bgColor: string;           // 배경색 ('' = 페이지 배경 그대로)
  bgColor2: string;          // 그라데이션 두 번째 색 (선택)
  bgImg: string;             // 배경 이미지 (선택)
  logo: string;              // 가운데 로고 이미지 (선택 — 없으면 사이트 이름 글자)
  logoW: number;             // 로고 폭 px
  caption: string;           // 아래 작은 문구 (예: click to enter)
  ink: string;               // 글자색 ('' = 페이지 제목색)
  every: boolean;            // 메인에 들어올 때마다 (끄면 브라우저 창마다 한 번)
}

export interface ParticleSettings {
  on: boolean; shape: FxShape; color: string; count: number; speed: number; size: number;
}

export interface TrailSettings {
  on: boolean; shape: FxShape; color: string; color2: string; size: number; amount: number; life: number;
}

export interface ClickSoundSettings { on: boolean; file: string; volume: number }

export interface SkinSettings {
  // 왼쪽 메뉴선 색 (위·가운데·아래) — 비우면 포인트 컬러·연한 포인트·로고 글씨색에서 자동
  railC1: string; railC2: string; railC3: string;
  /** 게시판 본문 카드 (사용자 요청 — 합작·갤러리·시트·썰·TRPG 기록·리뷰·로그·타래·달력)
   *  line = 테두리 있는 카드 · noline = 테두리 없는 카드 · none = 카드 없이 페이지 위에 바로 */
  cardStyle: 'line' | 'noline' | 'none';
  landing: LandingSettings;
  particles: ParticleSettings;
  trail: TrailSettings;
  click: ClickSoundSettings;
}

export const DEFAULT_SKIN: SkinSettings = {
  railC1: '', railC2: '', railC3: '',
  cardStyle: 'line',
  landing: { on: false, bgColor: '', bgColor2: '', bgImg: '', logo: '', logoW: 320, caption: 'click to enter', ink: '', every: false },
  particles: { on: false, shape: 'star', color: '#ffffff', count: 40, speed: 4, size: 7 },
  trail: { on: false, shape: 'star', color: '#ffffff', color2: '', size: 10, amount: 4, life: 5 },
  click: { on: false, file: '', volume: 50 },
};

const KEY = 'ohome.skin.v1';
const EVT = 'ohome-skin';

/** 저장본 + 기본값 병합 (나중에 항목이 늘어도 예전 저장본이 깨지지 않게 묶음마다 합친다) */
function merge(raw: Partial<SkinSettings> | null): SkinSettings {
  const r = raw ?? {};
  return {
    ...DEFAULT_SKIN, ...r,
    // 예전 저장본(테두리 켬/끔)도 그대로 읽는다
    cardStyle: r.cardStyle ?? ((r as { cardBorder?: boolean }).cardBorder === false ? 'noline' : 'line'),
    landing: { ...DEFAULT_SKIN.landing, ...(r.landing ?? {}) },
    particles: { ...DEFAULT_SKIN.particles, ...(r.particles ?? {}) },
    trail: { ...DEFAULT_SKIN.trail, ...(r.trail ?? {}) },
    click: { ...DEFAULT_SKIN.click, ...(r.click ?? {}) },
  };
}

export function readSkin(): SkinSettings {
  try {
    const raw = getRawSetting(KEY);
    return merge(raw ? JSON.parse(raw) : null);
  } catch { return merge(null); }
}

export function useSkinSettings(): [SkinSettings, (patch: Partial<SkinSettings>) => void, boolean] {
  const [st, setSt] = useState<SkinSettings>(DEFAULT_SKIN);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const load = () => setSt(readSkin());
    load();
    setLoaded(true);
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, []);
  const patch = useCallback((p: Partial<SkinSettings>) => {
    setSt(s => {
      const n = merge({ ...s, ...p });
      try { setSetting(KEY, n); } catch { /* 무시 */ }
      setTimeout(() => window.dispatchEvent(new Event(EVT)), 0);
      return n;
    });
  }, []);
  return [st, patch, loaded];
}
