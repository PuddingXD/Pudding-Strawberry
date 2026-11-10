// 말머리가 없는 글 모아보기 — 「말머리로 추가」하는 게 아니라 탭에 따로 붙는 보기 전용 항목이다.
// 환경설정의 말머리 목록에는 들어가지 않고, 글에 저장되는 값도 아니다.
export const NOCAT = '\u0001nocat';
export const NOCAT_LABEL = '구분 없음';

/** 말머리가 비었거나, 지금 정해 둔 말머리 목록에 없는 글 (말머리를 하나도 안 정해 둔 곳이면 해당 없음) */
export const lacksCat = (category: string | undefined | null, labels: string[]): boolean =>
  labels.length > 0 && (!category || !labels.includes(category));
