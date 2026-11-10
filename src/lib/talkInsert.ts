// 썰 백업(말풍선) 본문에 그림 넣기·빼기 — 말풍선을 우클릭해서 (사용자 요청: 카톡처럼 그림이 보이게)
//
// 말풍선은 본문 HTML을 줄로 쪼개 만든다(components/board/TalkView.tsx의 parseTalk). 같은 방식으로 본문을 훑으며
// 「몇 번째 줄이 본문 어디까지인지」를 적어 두면, 그 자리 바로 뒤에 <img>를 끼워 넣을 수 있다.
// parseTalk는 이미지를 바로 앞 줄(말한 사람)의 말풍선에 붙이므로, 줄 끝에 넣은 그림은 그 말풍선 안에 들어간다.

export interface TalkSlot {
  kind: 'say' | 'head' | 'note';
  endPos: number;                              // 이 줄(붙어 있는 그림 포함)이 끝나는 본문 위치
  imgs: { start: number; end: number }[];      // 붙어 있는 그림의 본문 위치
}

const TOK = /<img\b[^>]*>|<br\s*\/?>|<\/(?:p|div|li|h[1-6]|blockquote|pre|tr)>/gi;

function decode(s: string): string {
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
}

/** 본문 HTML → parseTalk와 같은 순서·개수의 줄 위치 목록 */
export function talkSlots(html: string): TalkSlot[] {
  const out: TalkSlot[] = [];
  const st = { last: null as TalkSlot | null };   // 클로저에서 바뀌므로 객체에 담는다 (TS 좁히기 방지)
  let seg = 0;   // 아직 줄로 안 만든 글자의 시작

  const addText = (from: number, to: number, endPos: number) => {
    const raw = html.slice(from, to);
    const noTag = !raw.includes('<');
    let off = from;
    for (const part of raw.split('\n')) {
      const lineEnd = off + part.length;
      off = lineEnd + 1;
      const line = decode(part.replace(/<[^>]+>/g, '')).trim();
      if (!line) continue;
      // 줄바꿈으로만 나뉜 글(태그 없음)은 줄마다 자기 끝 위치를, 태그가 섞인 글은 덩어리 끝을 쓴다
      const pos = noTag ? lineEnd : endPos;
      const kind: TalkSlot['kind'] = /^([1-4])\s*[:：]\s*/.test(line) ? 'say' : /^#+\s*(.+)$/.test(line) ? 'head' : 'note';
      st.last = { kind, endPos: pos, imgs: [] };
      out.push(st.last);
    }
  };

  let m: RegExpExecArray | null;
  TOK.lastIndex = 0;
  while ((m = TOK.exec(html))) {
    const end = m.index + m[0].length;
    if (/^<img/i.test(m[0])) {
      if (!/src=["'][^"']+["']/i.test(m[0])) continue;   // src 없는 이미지는 parseTalk도 글자처럼 지운다
      addText(seg, m.index, m.index);
      const img = { start: m.index, end };
      if (st.last && st.last.kind !== 'head') { st.last.imgs.push(img); st.last.endPos = end; }
      else { st.last = { kind: 'note', endPos: end, imgs: [img] }; out.push(st.last); }
      seg = end;
    } else {
      addText(seg, m.index, end);
      seg = end;
    }
  }
  addText(seg, html.length, html.length);
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** n번째 줄 끝에 그림 넣기 — 이미 붙은 그림이 있으면 그 뒤에 */
export function insertTalkImage(html: string, slot: TalkSlot, src: string): string {
  const pos = slot.endPos;
  const tag = `<img src="${esc(src)}" alt="">`;
  const before = html.slice(0, pos);
  const wrap = /<\/(?:p|div)>$/i.test(before) ? `<p>${tag}</p>` : tag;
  return before + wrap + html.slice(pos);
}

/** 줄에 붙은 j번째 그림 빼기 (그림만 든 빈 <p>도 같이 정리) */
export function removeTalkImage(html: string, slot: TalkSlot, j: number): string {
  const im = slot.imgs[j];
  if (!im) return html;
  let a = im.start, b = im.end;
  const pre = html.slice(0, a), post = html.slice(b);
  const m1 = /<p[^>]*>$/i.exec(pre), m2 = /^<\/p>/i.exec(post);
  if (m1 && m2) { a -= m1[0].length; b += m2[0].length; }
  return html.slice(0, a) + html.slice(b);
}

export const fileToDataUrl = (f: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result));
  r.onerror = () => rej(r.error);
  r.readAsDataURL(f);
});
