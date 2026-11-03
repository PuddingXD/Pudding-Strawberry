'use client';
// 썰 백업 게시판 (B 디자인에서 가져온 기능) — 본문을 대화 말풍선으로 보여 준다.
//
// 본문은 평소처럼 에디터로 쓰고, 줄마다 이렇게 적는다:
//   1: 왼쪽 사람이 하는 말        2: 오른쪽 사람이 하는 말
//   # 소제목  (대화 묶음 사이 구분)  그 밖의 줄 = 가운데 지문
//   이미지를 넣으면 바로 위 줄을 말한 사람의 말풍선으로 들어간다
import React, { useMemo } from 'react';

type Line =
  | { k: 'say'; who: 1 | 2; text: string; imgs: string[] }
  | { k: 'head'; text: string }
  | { k: 'note'; text: string; imgs: string[] };

function decode(s: string): string {
  if (typeof document === 'undefined') return s;
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
}

/** 정리된(안전한) HTML → 줄 목록 */
export function parseTalk(safeHtml: string): Line[] {
  const flat = safeHtml
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n\u0000IMG:$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const out: Line[] = [];
  let last: Line | null = null;
  for (const rawLine of decode(flat).split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('\u0000IMG:')) {
      const src = line.slice(5);
      if (last && (last.k === 'say' || last.k === 'note')) last.imgs.push(src);
      else { last = { k: 'note', text: '', imgs: [src] }; out.push(last); }
      continue;
    }
    const m = /^([12])\s*[:：]\s*(.*)$/.exec(line);
    if (m) { last = { k: 'say', who: m[1] === '1' ? 1 : 2, text: m[2], imgs: [] }; out.push(last); continue; }
    const h = /^#+\s*(.+)$/.exec(line);
    if (h) { last = { k: 'head', text: h[1] }; out.push(last); continue; }
    last = { k: 'note', text: line, imgs: [] };
    out.push(last);
  }
  return out;
}

export function TalkView({ html, n1, n2, c1, c2 }: { html: string; n1?: string; n2?: string; c1?: string; c2?: string }) {
  const lines = useMemo(() => parseTalk(html), [html]);
  const style = {
    ...(c1 ? { '--talk-c1': c1 } : {}),
    ...(c2 ? { '--talk-c2': c2 } : {}),
  } as React.CSSProperties;
  return (
    <div className="talk" style={style}>
      {lines.map((l, i) => {
        if (l.k === 'head') return <div key={i} className="talk-head"><span>{l.text}</span></div>;
        if (l.k === 'note') {
          return (
            <div key={i} className="talk-note">
              {l.text && <p>{l.text}</p>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.imgs.map(src => <img key={src} src={src} alt="" />)}
            </div>
          );
        }
        const prev = lines[i - 1];
        const first = !(prev && prev.k === 'say' && prev.who === l.who);   // 같은 사람이 이어 말하면 이름은 처음에만
        const name = l.who === 1 ? n1 : n2;
        return (
          <div key={i} className={`talk-row ${l.who === 1 ? 'l' : 'r'} ${first ? 'first' : ''}`}>
            {first && name && <b className="talk-name">{name}</b>}
            <div className="talk-bub">
              {l.text && <span>{l.text}</span>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.imgs.map(src => <img key={src} src={src} alt="" />)}
            </div>
          </div>
        );
      })}
      {lines.length === 0 && <p className="hint" style={{ textAlign: 'center' }}>대화가 없습니다</p>}
    </div>
  );
}

/** 목록에 보일 대화 수 (말한 줄 수) */
export const talkCount = (safeHtml: string) => parseTalk(safeHtml).filter(l => l.k === 'say').length;
