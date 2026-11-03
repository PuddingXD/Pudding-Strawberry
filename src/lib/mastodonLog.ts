'use client';
// 마스토돈 타래 백업 → 역극 로그 (사용자 요청 — 디스코드 가져오기와 같은 길).
//
// 받는 것 (「마스토돈 타래 백업」 프로그램의 결과물):
//   · JSON  — { backup_info, toots: [{ created_at, account: { display_name, acct, avatar }, content(HTML), spoiler_text }] }
//   · HTML  — <div class="mtb-toot"><img alt="이름의 프로필 사진"> … 이름 … 본문 … <a><span>날짜</span><span>시각</span></a></div>
// 결과는 디스코드 가져오기와 같은 모양(DcParsed)이라, 발화자 → 캐릭터 매칭·메신저/대본 모양·프로필 사진·「본문 편집」을 그대로 쓴다.
// 본문의 서식은 마크다운으로 바꿔 둔다 — **굵게**, *기울임*, ~~취소선~~, 줄바꿈 (로그가 그릴 때 다시 살린다: rpLog.ts의 inlineMd)
import type { DcParsed, DcMessage } from './discordLog';

export interface MastoParsed extends DcParsed {
  /** 발화자 이름 → 마스토돈 프로필 사진 주소 (참고용) */
  avatars: Record<string, string>;
  title: string;
}

/** 마스토돈 본문 HTML → 마크다운 글. 멘션(@아이디)은 뺀다 */
export function mastoHtmlToMd(html: string): string {
  let s = html
    .replace(/<span class="h-card"[^>]*>\s*<a [^>]*>[\s\S]*?<\/a>\s*<\/span>/gi, '')   // 멘션 묶음 (<span class=h-card><a>@<span>id</span></a></span>)
    .replace(/<a [^>]*class="[^"]*\bmention\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(strong|b)(\s[^>]*)?>/gi, '**')
    .replace(/<\/?(em|i)(\s[^>]*)?>/gi, '*')
    .replace(/<\/?(del|s|strike)(\s[^>]*)?>/gi, '~~')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s.replace(/[ \t]+\n/g, '\n').replace(/^\s*@\S+\s+/, '').trim();
}

function decodeEntities(s: string): string {
  if (typeof document !== 'undefined') {
    const t = document.createElement('textarea');
    t.innerHTML = s;
    return t.value;
  }
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function finish(messages: DcMessage[], avatars: Record<string, string>, title: string): MastoParsed {
  const counts = new Map<string, number>();
  messages.forEach(m => counts.set(m.speaker, (counts.get(m.speaker) ?? 0) + 1));
  return { messages, speakers: [...counts].map(([name, count]) => ({ name, count })), avatars, title };
}

type Toot = {
  created_at?: string; content?: string; spoiler_text?: string;
  account?: { display_name?: string; acct?: string; username?: string; avatar?: string };
  media_attachments?: { url?: string; description?: string }[];
};

function fromJson(raw: string): MastoParsed | null {
  let d: { toots?: Toot[]; backup_info?: { participants?: { display_name?: string }[] } };
  try { d = JSON.parse(raw); } catch { return null; }
  if (!d || !Array.isArray(d.toots) || !d.toots.length) return null;
  const toots = [...d.toots].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  const avatars: Record<string, string> = {};
  const messages: DcMessage[] = toots.map(t => {
    const name = (t.account?.display_name || t.account?.acct || t.account?.username || '?').trim();
    if (t.account?.avatar) avatars[name] = t.account.avatar;
    let text = mastoHtmlToMd(t.content ?? '');
    if (t.spoiler_text?.trim()) text = `(${t.spoiler_text.trim()})\n${text}`;   // 열람 주의(CW) 문구는 첫 줄에
    const media = (t.media_attachments ?? []).filter(m => m.url).length;
    if (media) text += `${text ? '\n' : ''}[이미지 ${media}장]`;
    return { speaker: name, date: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(), text };
  }).filter(m => m.text);
  const names = (d.backup_info?.participants ?? []).map(p => p.display_name).filter(Boolean);
  return finish(messages, avatars, names.join(' · '));
}

function fromHtml(raw: string): MastoParsed | null {
  if (!/class="mtb-toot"/.test(raw) || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const avatars: Record<string, string> = {};
  const messages: DcMessage[] = [];
  // 날짜는 날이 바뀌는 첫 글에만 붙고 나머지는 시각만 있다 — 앞 날짜를 이어받는다
  let day: [number, number, number] | null = null;
  doc.querySelectorAll('.mtb-toot').forEach(el => {
    const img = el.querySelector('img');
    const box = img?.nextElementSibling ?? el;
    const nameEl = box.firstElementChild;
    const name = (nameEl?.textContent || img?.getAttribute('alt')?.replace(/의 프로필 사진$/, '') || '?').trim();
    if (img?.getAttribute('src')) avatars[name] = img.getAttribute('src')!;
    // 본문 = 이름 다음 칸에서 날짜 링크를 뺀 부분
    const body = nameEl?.nextElementSibling;
    const link = body?.querySelector('a[href]');
    const spans = link ? [...link.querySelectorAll('span')].map(s => s.textContent ?? '') : [];
    link?.remove();
    const text = mastoHtmlToMd(body?.innerHTML ?? '');
    const all = spans.join(' ');
    const dm = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(all);
    if (dm) day = [+dm[1], +dm[2] - 1, +dm[3]];
    const tm = /(\d{1,2}):(\d{2})(?!.*\d{1,2}:\d{2})/.exec(all);
    const date = day ? new Date(day[0], day[1], day[2], tm ? +tm[1] : 0, tm ? +tm[2] : 0).toISOString() : new Date().toISOString();
    if (text) messages.push({ speaker: name, date, text });
  });
  return messages.length ? finish(messages, avatars, '') : null;
}

/** 마스토돈 타래 백업이면 읽어서 돌려준다 (아니면 null) */
export function parseMastodonLog(raw: string): MastoParsed | null {
  const t = raw.trim();
  if (t.startsWith('{')) return fromJson(t);
  if (t.includes('mtb-toot')) return fromHtml(t);
  return null;
}
