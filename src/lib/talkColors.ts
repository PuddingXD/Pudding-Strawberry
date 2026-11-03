'use client';
// 썰 백업 — 자주 나오는 사람의 기본 말풍선 색 (사용자 요청).
// 사람마다 이름 여러 개(예: 호라 · 호라님)를 한 묶음으로 두고 색 하나를 정한다.
// 글에서 그 사람의 색을 따로 안 정했으면 이 색으로 그린다. 사이트 설정 한 키에 저장 (관리자 쓰기, 모두 읽기).
import { useCallback, useEffect, useState } from 'react';
import { getRawSetting, setSetting } from './settingStore';

export interface TalkColorGroup { names: string[]; color: string }

const KEY = 'ohome.talkColors.v1';
const EVT = 'ohome-talk-colors';

/** 처음 묶음 — 색은 비어 있다. 썰 글 편집 화면의 「이 글의 색을 기본으로」로 채운다 */
export const DEFAULT_TALK_GROUPS: TalkColorGroup[] = [
  { names: ['호라', '호라님'], color: '' },
  { names: ['곰주', '곰주님'], color: '' },
  { names: ['푸딩', '수현'], color: '' },
];

export function readTalkGroups(): TalkColorGroup[] {
  try {
    const raw = getRawSetting(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v : DEFAULT_TALK_GROUPS;
  } catch { return DEFAULT_TALK_GROUPS; }
}

const norm = (s: string) => s.trim().replace(/\s+/g, '').toLowerCase();

/** 이 이름의 묶음 번호 (없으면 -1) — 「님」을 붙이든 안 붙이든 같은 사람으로 */
export function groupIndexOf(groups: TalkColorGroup[], name: string): number {
  const n = norm(name);
  if (!n) return -1;
  const bare = n.replace(/님$/, '');
  return groups.findIndex(g => g.names.some(x => { const y = norm(x); return y === n || y.replace(/님$/, '') === bare; }));
}

export function talkColorOf(groups: TalkColorGroup[], name: string): string | undefined {
  const i = groupIndexOf(groups, name);
  return i >= 0 && groups[i].color ? groups[i].color : undefined;
}

export function useTalkColors(): [TalkColorGroup[], (g: TalkColorGroup[]) => void] {
  const [groups, setGroups] = useState<TalkColorGroup[]>(DEFAULT_TALK_GROUPS);
  useEffect(() => {
    const load = () => setGroups(readTalkGroups());
    load();
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, []);
  const save = useCallback((g: TalkColorGroup[]) => {
    setGroups(g);
    try { setSetting(KEY, g); } catch { /* 무시 */ }
    setTimeout(() => window.dispatchEvent(new Event(EVT)), 0);
  }, []);
  return [groups, save];
}
