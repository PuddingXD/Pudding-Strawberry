'use client';
// 휴지통 (B 디자인에서 가져온 기능) — 지운 항목을 30일 동안 보관했다가 되살릴 수 있게.
//
// 모든 목록 저장은 lib/db.ts의 syncList를 지나간다. 거기서 「이전 목록에 있었는데 새 목록에 없는」 항목
// (= 삭제)을 찾아 trash 컬렉션에 사본으로 남긴다. 화면마다 삭제 코드를 고치지 않아도 어디서 지우든 잡힌다.
// 사본은 비공개(private)로 저장돼 지운 사람과 관리자만 읽을 수 있다 (보안 규칙의 공통 읽기 조건).
import type { ListItem } from './backend/types';
import { sortableId } from './order';

export const TRASH_KEY = 'ohome.trash.v1';
export const TRASH_COLL = 'trash';
export const TRASH_DAYS = 30;

// type 별칭으로 둔다 — interface는 ListItem(인덱스 시그니처)에 그대로 넘길 수 없다
export type TrashEntry = {
  id: string;
  coll: string;           // 원래 컬렉션
  itemId: string;         // 원래 항목 id
  title: string;          // 목록에 보일 이름
  data: ListItem;         // 지우기 직전 항목 전체
  deletedAt: string;      // ISO
  by: string;             // 지운 회원 id
  visibility: 'private';
};

/** 휴지통에 남기지 않는 것 — 임시 데이터·알림·기기 구독, 그리고 휴지통 자신 */
const SKIP = new Set([TRASH_COLL, 'rp_typing', 'notifications', 'push_subs']);
export const isTrashable = (coll: string) => !SKIP.has(coll);

/** 컬렉션 → 한국어 이름 (휴지통 목록 표시용) */
export const COLL_LABEL: Record<string, string> = {
  posts: '게시판 글', guestbook: '방명록', characters: '캐릭터', relations: '자관', gallery: '갤러리',
  feed: '큰 그림', roadview: '로드비', trpg_logs: 'TRPG 로그', trpg_log_bodies: 'TRPG 로그 본문',
  trpg_chars: 'TRPG 캐릭터', dotori: '도토리', playlog: '플레이기록·시트', rp_rooms: '역극 방', threads: '감상타래',
  diary: '다이어리', memos: '메모', moods: '무드', comments: '댓글', qa_answers: '자관 문답 답변',
  rp_messages: '역극 대사', sched_events: '일정', trpg_reviews: 'TRPG 리뷰',
};

function strip(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 항목에서 사람이 알아볼 이름 뽑기 */
export function titleOf(item: ListItem): string {
  for (const k of ['title', 'name', 'label', 'nickname', 'scenario', 'text', 'body', 'message']) {
    const v = item[k];
    if (typeof v === 'string' && v.trim()) {
      const t = k === 'body' || k === 'text' || k === 'message' ? strip(v) : v.trim();
      if (t) return t.length > 60 ? `${t.slice(0, 60)}…` : t;
    }
  }
  return `(제목 없음 · ${item.id})`;
}

export function makeTrashEntries(coll: string, removed: ListItem[], uid: string | null): TrashEntry[] {
  const now = new Date().toISOString();
  return removed.map(it => ({
    id: sortableId(), coll, itemId: it.id, title: titleOf(it), data: it,
    deletedAt: now, by: uid ?? '', visibility: 'private' as const,
  }));
}

export const isExpired = (e: TrashEntry, now = Date.now()) =>
  now - new Date(e.deletedAt).getTime() > TRASH_DAYS * 86400000;
