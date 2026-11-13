'use client';
// 마우스 커서 관리 (5.1 v1.1) — 상태별 커서 이미지(png 32px 권장) + 핫스팟 + 전체 on/off.
// 등록하지 않은 상태는 기본 커서로 폴백.
import { useCallback, useEffect, useState } from 'react';
import { getRawSetting, setSetting } from './settingStore';

// 이동·크기조절 커서 분리 (v1.9 사용자 요청) — 이동/드래그 하나로 퉁치지 않고
// 윈도우 커서 세트처럼 이동 + 크기조절 4방향을 각각 등록
export type CursorState = 'default' | 'pointer' | 'text' | 'active' | 'grab'
  | 'rsNwse' | 'rsNesw' | 'rsEw' | 'rsNs'
  // 윈도우 커서 세트의 나머지 (v2.1 사용자 요청 — 세트 15종을 다 올릴 수 있게)
  | 'help' | 'busy' | 'working' | 'precision' | 'unavailable' | 'alternate' | 'handwriting' | 'location' | 'person';

export interface CursorEntry { imgId: string; hx: number; hy: number } // 핫스팟 (px)

export type CursorStates = Partial<Record<CursorState, CursorEntry>>;

/** 커서를 다르게 보일 구분 — 'base' = 일반(지정하지 않은 모두) · 'admin' = 관리자 · 'member' = 로그인한 회원 전체 · 'u:<회원 아이디>' = 그 회원 하나 */
export type CursorScope = string;

export interface CursorSettings {
  enabled: boolean;
  states: CursorStates;                      // 일반 (기본 — 구분을 지정하지 않은 모두)
  roles?: Record<CursorScope, CursorStates>; // 관리자·회원별로 덮어쓸 커서 (v2.1 사용자 요청)
}

export const scopeStates = (st: CursorSettings, scope: CursorScope): CursorStates =>
  scope === 'base' ? st.states : (st.roles?.[scope] ?? {});

export const withScopeStates = (st: CursorSettings, scope: CursorScope, states: CursorStates): Partial<CursorSettings> =>
  scope === 'base' ? { states } : { roles: { ...(st.roles ?? {}), [scope]: states } };

/** 지금 보는 사람에게 실제로 보일 커서 — 상태마다 「그 회원 > 관리자/회원 전체 > 일반」 순으로 찾고, 없으면 다음 순서 */
export function effectiveStates(st: CursorSettings, who: { id: string; admin: boolean } | null): CursorStates {
  const out: CursorStates = { ...st.states };
  if (who && st.roles) {
    Object.assign(out, st.roles[who.admin ? 'admin' : 'member'] ?? {});
    Object.assign(out, st.roles[`u:${who.id}`] ?? {});
  }
  return out;
}

export const CURSOR_STATE_LABEL: Record<CursorState, { label: string; desc: string }> = {
  default: { label: '기본', desc: '평상시' },
  pointer: { label: '포인터(호버)', desc: '링크·버튼 위' },
  text: { label: '텍스트', desc: '입력창·텍스트 위 (I-빔 대체)' },
  active: { label: '클릭 중', desc: '누르는 동안 (선택)' },
  grab: { label: '이동', desc: '위젯·스티커 드래그 이동 시 (선택)' },
  rsNwse: { label: '크기조절 ↘', desc: '대각선 크기 조절 1 — 위젯 우하단 핸들 (선택)' },
  rsNesw: { label: '크기조절 ↙', desc: '대각선 크기 조절 2 (선택)' },
  rsEw: { label: '크기조절 ↔', desc: '가로 크기 조절 (선택)' },
  rsNs: { label: '크기조절 ↕', desc: '세로 크기 조절 (선택)' },
  help: { label: '도움말 (help select)', desc: '도움말·약어 표시가 있는 글자 위 (선택)' },
  busy: { label: '대기 (busy)', desc: '업로드 등 기다려야 하는 동안 화면 전체 (선택)' },
  working: { label: '백그라운드 작업 (working in background)', desc: '불러오는 중 표시가 있는 곳 위 (선택)' },
  precision: { label: '정밀 선택 (precision select)', desc: '그림 자르기 등 캔버스 위 (선택)' },
  unavailable: { label: '사용 불가 (unavailable)', desc: '비활성(눌러도 반응 없는) 버튼 위 (선택)' },
  alternate: { label: '대체 선택 (alternate select)', desc: '예약 — 요소에 data-cur="alternate"를 달면 적용 (선택)' },
  handwriting: { label: '손글씨 (handwriting)', desc: '스티커 메모 입력칸 위 (선택)' },
  location: { label: '위치 선택 (location select)', desc: '문서 목차·문서 탭 위 (선택)' },
  person: { label: '사람 선택 (person select)', desc: '프로필·아바타 위 (선택)' },
};

export const DEFAULT_CURSOR_SETTINGS: CursorSettings = { enabled: true, states: {} };

const KEY = 'ohome.cursor.v1';
const EVT = 'ohome-cursor';

export function useCursorSettings(): [CursorSettings, (patch: Partial<CursorSettings>) => void, boolean] {
  const [st, setSt] = useState<CursorSettings>(DEFAULT_CURSOR_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const load = () => {
      try {
        const raw = getRawSetting(KEY);
        if (raw) setSt({ ...DEFAULT_CURSOR_SETTINGS, ...JSON.parse(raw) });
      } catch { /* 기본값 */ }
    };
    load();
    setLoaded(true);
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, []);
  const patch = useCallback((p: Partial<CursorSettings>) => {
    setSt(s => {
      const n = { ...s, ...p };
      try { setSetting(KEY, n); } catch { /* 무시 */ }
      setTimeout(() => window.dispatchEvent(new Event(EVT)), 0);
      return n;
    });
  }, []);
  return [st, patch, loaded];
}
