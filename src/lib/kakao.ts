'use client';
// 카카오톡 대화 내보내기(.txt) → 썰 백업 본문 (사용자 요청)
//
// 읽는 형식
//   PC:     [이름] [오후 8:56] 내용          + 「--------------- 2025년 5월 2일 금요일 ---------------」 날짜 줄
//   모바일: 2025. 5. 2. 오후 8:56, 이름 : 내용 (안드로이드)  ·  2025년 5월 2일 오후 8:56, 이름 : 내용 (아이폰)
//           + 「2025년 5월 2일 금요일」 날짜 줄
// 접두어 없는 줄은 바로 앞 메시지가 여러 줄인 것 — 같은 사람의 말로 이어 붙인다.

export type KakaoItem = { kind: 'date'; text: string } | { kind: 'msg'; name: string; text: string };

export interface KakaoParsed {
  title: string;                              // 「○○ 님과 카카오톡 대화」의 ○○ (없으면 '')
  items: KakaoItem[];
  speakers: { name: string; count: number }[]; // 말한 횟수 많은 순
}

const PC_MSG = /^\[(.+?)\] \[(?:오전|오후|AM|PM) ?\d{1,2}:\d{2}\] ?(.*)$/;
const PC_DATE = /^-{3,}\s*(.+?)\s*-{3,}$/;
const MO_MSG = /^(\d{4})[.년]\s*(\d{1,2})[.월]\s*(\d{1,2})[.일]?\s*(?:(?:오전|오후|AM|PM)\s*)?\d{1,2}:\d{2},\s*(.+?)\s:\s?(.*)$/;
const MO_DATE = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(\s*[월화수목금토일]요일)?$/;
const TITLE = /^(.+?)\s*님과 카카오톡 대화$/;

export function parseKakao(raw: string): KakaoParsed {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  const items: KakaoItem[] = [];
  let title = '';
  let last: Extract<KakaoItem, { kind: 'msg' }> | null = null;
  let started = false;
  let lastDay = '';
  for (const line of lines) {
    const t = line.trimEnd();
    if (!started) {
      const tt = TITLE.exec(t.trim());
      if (tt && !title) { title = tt[1]; continue; }
    }
    const d1 = PC_DATE.exec(t.trim()) ?? MO_DATE.exec(t.trim());
    if (d1) {
      const text = PC_DATE.test(t.trim()) ? d1[1] : t.trim();
      items.push({ kind: 'date', text }); lastDay = text; last = null; started = true; continue;
    }
    const pc = PC_MSG.exec(t);
    if (pc) { last = { kind: 'msg', name: pc[1].trim(), text: pc[2] }; items.push(last); started = true; continue; }
    const mo = MO_MSG.exec(t);
    if (mo) {
      // 모바일 형식은 날짜가 줄마다 붙어 있다 — 날이 바뀔 때만 날짜 줄을 하나 넣는다
      const day = `${mo[1]}년 ${Number(mo[2])}월 ${Number(mo[3])}일`;
      if (day !== lastDay && !lastDay.startsWith(day)) { items.push({ kind: 'date', text: day }); lastDay = day; }
      last = { kind: 'msg', name: mo[4].trim(), text: mo[5] }; items.push(last); started = true; continue;
    }
    if (!started) continue;                 // 머리말(저장한 날짜 등)
    if (last) last.text += `\n${t}`;        // 여러 줄 메시지의 이어지는 줄
  }
  // 이어 붙인 줄 끝의 빈 줄 정리
  for (const it of items) if (it.kind === 'msg') it.text = it.text.replace(/\n+$/, '');
  const count = new Map<string, number>();
  for (const it of items) if (it.kind === 'msg') count.set(it.name, (count.get(it.name) ?? 0) + 1);
  const speakers = [...count.entries()].map(([name, c]) => ({ name, count: c })).sort((a, b) => b.count - a.count);
  return { title, items, speakers };
}

/** 사람마다 정한 자리: 1~4 = 말풍선 번호 · 'note' = 가운데 지문 · 'skip' = 빼기 */
export type KakaoSlot = 1 | 2 | 3 | 4 | 'note' | 'skip';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 썰 백업 본문(에디터 HTML) 만들기 — 줄마다 <p>N: 내용</p>, 날짜는 <p># 날짜</p> */
export function kakaoToBody(p: KakaoParsed, slot: Record<string, KakaoSlot>, opt: { dates: boolean }): string {
  const out: string[] = [];
  for (const it of p.items) {
    if (it.kind === 'date') { if (opt.dates) out.push(`<p># ${esc(it.text)}</p>`); continue; }
    const s = slot[it.name] ?? 'skip';
    if (s === 'skip') continue;
    for (const ln of it.text.split('\n')) {
      if (!ln.trim()) continue;
      out.push(s === 'note' ? `<p>${esc(ln)}</p>` : `<p>${s}: ${esc(ln)}</p>`);
    }
  }
  // 날짜 줄만 남고 내용이 없는 날은 뺀다
  return out.filter((l, i) => !(l.startsWith('<p># ') && (out[i + 1] === undefined || out[i + 1].startsWith('<p># ')))).join('');
}

/** 썰 백업 본문에서 두 번호를 맞바꾸기 (1: ↔ 2: 등) — 줄 맨 앞의 번호만 바꾼다 */
export function swapTalkNumbers(body: string, a: number, b: number): string {
  if (a === b) return body;
  return body.replace(/(^|<p[^>]*>|\n|<br\s*\/?>)(\s*)([1-4])(\s*[:：])/g, (m, pre: string, sp: string, n: string, colon: string) => {
    const k = Number(n);
    const to = k === a ? b : k === b ? a : k;
    return `${pre}${sp}${to}${colon}`;
  });
}
