// 시트 게시판 (/sheet) — 구글 스프레드시트 링크 모음.
//
// **DB를 바꾸지 않는다.** 항목은 플레이기록(`playlog`)과 같은 목록에 쌓이고, 소속 표시(secId)에
// `sheet:` 머리를 붙여 구분한다 → 플레이기록 쪽에서는 (기본 섹션도 추가 섹션도) 이 항목이 걸러져 안 보이고,
// 시트 게시판에서는 이 항목만 보인다. 포크 사용자가 SQL·Firestore 규칙을 다시 적용할 일이 없다.
//
// 필드 매핑 (PlayRecord 재사용):  With(말머리) = withText · Name(시트 이름) = scenario · Url(시트 링크) = url · Check = chkAdmin / chkMember
import type { PlayRecord } from './galleryStore';
import { MAIN_SEC } from './sectionStore';

export const SHEET_PREFIX = 'sheet:';
export const SHEET_KEY = 'ohome.playlog.v1';

/** 시트 항목에 찍는 소속 표시 */
export const sheetSecOf = (secId: string) => SHEET_PREFIX + secId;

/** 시트 항목인가 */
export const isSheetRec = (r: { secId?: string }) => !!r.secId && r.secId.startsWith(SHEET_PREFIX);

/** 시트 항목의 섹션 id (기본 섹션이면 'main') */
export const sheetSecId = (r: { secId?: string }) => (isSheetRec(r) ? r.secId!.slice(SHEET_PREFIX.length) || MAIN_SEC : MAIN_SEC);

/** 이 섹션의 시트 항목만 */
export const sheetsOf = (all: PlayRecord[], secId: string) => all.filter(r => r.secId === sheetSecOf(secId));

/**
 * 이 섹션 자리만 갈아 끼우는 저장 함수 — 다른 섹션·플레이기록 항목은 그대로 둔다
 * (sectionStore.sectionSetter와 같은 원리, 소속 표시만 `sheet:` 머리가 붙는다)
 */
export function sheetSetter(all: PlayRecord[], secId: string, setAll: (next: PlayRecord[]) => void) {
  const key = sheetSecOf(secId);
  return (next: PlayRecord[]) => {
    const others = all.filter(r => r.secId !== key);
    setAll([...next.map(r => (r.secId === key ? r : { ...r, secId: key })), ...others]);
  };
}

/** 폼 값 ↔ 저장 모양 */
export interface SheetFormValue { head: string; name: string; url: string }

export const toRecord = (v: SheetFormValue): Omit<PlayRecord, 'id'> => ({
  date: undefined,                  // 시트 게시판은 Date를 쓰지 않는다 — 기본 정렬은 등록한 순서
  scenario: v.name,
  withText: v.head,
  url: v.url,
  writer: '', role: '', playtime: '',   // 플레이기록 모양을 맞추기 위한 빈 칸
});

export const httpOk = (u: string) => /^https?:\/\/\S+$/i.test(u.trim());
