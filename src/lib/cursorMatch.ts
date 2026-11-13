// 커서 파일 묶음(ZIP · 폴더 · 여러 파일)을 풀어 칸에 자동으로 맞춘다 (v2.1 사용자 요청)
// Windows 커서 세트(normal select · link select · text select · move · diagonal resize …)의 파일 이름으로 찾고,
// 세트에 설치용 .inf 파일이 있으면 그 안의 대응표를 먼저 쓴다. 외부 라이브러리 없이 ZIP은 직접 읽는다(브라우저 내장 해제기 사용).
import type { CursorState } from './cursorStore';

export interface Cand { path: string; file: File }

const IMG_EXT = /\.(ani|cur|ico|png|gif|webp)$/i;
const EXT_RANK: Record<string, number> = { ani: 0, cur: 1, ico: 2, png: 3, gif: 4, webp: 5 };
const extOf = (n: string) => (/\.([a-z]+)$/i.exec(n)?.[1] ?? '').toLowerCase();
const baseOf = (p: string) => p.replace(/^.*[\\/]/, '');

/* ───────── ZIP 읽기 — 저장(0)·deflate(8) 두 방식이면 충분하다 ───────── */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(file: File): Promise<Cand[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return [];
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out: Cand[] = [];
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lpos = dv.getUint32(p + 42, true);
    const nameBytes = buf.subarray(p + 46, p + 46 + nlen);
    p += 46 + nlen + elen + clen;
    // 이름 인코딩 — UTF-8 표시가 없는 옛 윈도우 압축은 한글이 CP949다
    let name: string;
    try { name = new TextDecoder(flags & 0x800 ? 'utf-8' : 'euc-kr').decode(nameBytes); } catch { name = new TextDecoder().decode(nameBytes); }
    if (name.endsWith('/') || /(^|\/)__MACOSX\//.test(name)) continue;
    if (!IMG_EXT.test(name) && !/\.inf$/i.test(name)) continue;   // 필요한 것만 푼다
    if (dv.getUint32(lpos, true) !== 0x04034b50) continue;
    const start = lpos + 30 + dv.getUint16(lpos + 26, true) + dv.getUint16(lpos + 28, true);
    const comp = buf.subarray(start, start + csize);
    try {
      const data = method === 0 ? comp : method === 8 ? await inflateRaw(comp) : null;
      if (data) out.push({ path: name, file: new File([data as BlobPart], baseOf(name)) });
    } catch { /* 깨진 항목은 건너뛴다 */ }
  }
  return out;
}

/* ───────── 끌어 놓은 것(파일·폴더) 모으기 ───────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function walk(entry: any, prefix: string, out: Cand[]): Promise<void> {
  if (entry.isFile) {
    const f: File = await new Promise((ok, no) => entry.file(ok, no));
    out.push({ path: prefix + entry.name, file: f });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    for (;;) {
      // readEntries는 한 번에 100개까지만 준다 — 빌 때까지 반복
      const batch: unknown[] = await new Promise((ok, no) => reader.readEntries(ok, no));
      if (!batch.length) break;
      for (const e of batch) await walk(e, `${prefix}${entry.name}/`, out);
    }
  }
}

export async function candsFromDrop(dt: DataTransfer): Promise<Cand[]> {
  const out: Cand[] = [];
  const items = Array.from(dt.items ?? []);
  const entries = items.map(i => (i as DataTransferItem & { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) { for (const e of entries) await walk(e, '', out); }
  else for (const f of Array.from(dt.files)) out.push({ path: f.name, file: f });
  return expand(out);
}

/** 파일 입력(여러 파일 / 폴더 선택)에서 */
export async function candsFromInput(files: FileList | null): Promise<Cand[]> {
  const out = Array.from(files ?? []).map(f => ({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, file: f }));
  return expand(out);
}

/** ZIP은 풀어서 안의 파일로 바꿔 놓는다 */
async function expand(list: Cand[]): Promise<Cand[]> {
  const out: Cand[] = [];
  for (const c of list) {
    if (/\.zip$/i.test(c.file.name)) out.push(...(await readZip(c.file)));
    else out.push(c);
  }
  return out;
}

/* ───────── 이름으로 칸 찾기 ───────── */
// 위에서부터 먼저 걸리는 것 — 「…select」가 붙은 윈도우 이름은 더 구체적인 것을 앞에 둔다
const RULES: [RegExp, CursorState][] = [
  [/alternate|alt[ _-]?select|up[ _-]?arrow/, 'alternate'],
  [/handwriting|handwrit|writing|\bpen\b/, 'handwriting'],
  [/unavailable|not[ _-]?allowed|forbidden|prohibit|^no$|\bno[ _-]?drop/, 'unavailable'],
  [/working|background|progress|app[ _-]?start/, 'working'],
  [/busy|wait|hourglass|loading/, 'busy'],
  [/help|question/, 'help'],
  [/precision|cross(hair)?/, 'precision'],
  [/location|\bpin\b/, 'location'],
  [/person|\buser\b/, 'person'],
  [/vertical|\bvert\b|ns[ _-]?resize|size[ _-]?ns|up[ _-]?down|\bns\b/, 'rsNs'],
  [/horizontal|\bhorz\b|ew[ _-]?resize|size[ _-]?we|left[ _-]?right|\bew\b/, 'rsEw'],
  [/diagonal[ _-]?(resize)?[ _-]?(1|one)\b|dgn[ _-]?1|diag[ _-]?1|nwse|nw[ _-]?se/, 'rsNwse'],
  [/diagonal[ _-]?(resize)?[ _-]?(2|two)\b|dgn[ _-]?2|diag[ _-]?2|nesw|ne[ _-]?sw/, 'rsNesw'],
  [/move|size[ _-]?all|grab|drag/, 'grab'],
  [/text|i[ _-]?beam/, 'text'],
  [/link|hyperlink|^hand$|finger/, 'pointer'],
  [/click|press|\bactive\b/, 'active'],
  [/normal|arrow|default|pointer|\bselect\b|^cursor$|^main$/, 'default'],
];
export const stateByName = (file: string): CursorState | null => {
  const n = baseOf(file).replace(/\.[a-z]+$/i, '').toLowerCase();
  for (const [re, st] of RULES) if (re.test(n)) return st;
  return null;
};

// 윈도우 커서 세트의 설치 파일(.inf)에 적힌 이름표 → 칸
const INF_KEYS: Record<string, CursorState> = {
  pointer: 'default', help: 'help', work: 'working', busy: 'busy', cross: 'precision', text: 'text', hand: 'handwriting',
  unavailable: 'unavailable', vert: 'rsNs', horz: 'rsEw', dgn1: 'rsNwse', dgn2: 'rsNesw', move: 'grab',
  alternate: 'alternate', link: 'pointer', person: 'person', pin: 'location',
};
async function readText(f: File): Promise<string> {
  const b = new Uint8Array(await f.arrayBuffer());
  const utf = new TextDecoder('utf-8').decode(b);
  return utf.includes('�') ? new TextDecoder('euc-kr').decode(b) : utf;
}
async function infMap(cands: Cand[]): Promise<Map<string, CursorState>> {
  const map = new Map<string, CursorState>();   // 파일 이름(소문자) → 칸
  for (const c of cands.filter(x => /\.inf$/i.test(x.file.name))) {
    for (const line of (await readText(c.file)).split(/\r?\n/)) {
      const m = /^\s*([a-z0-9_]+)\s*=\s*"?([^"%\r\n]+?)"?\s*$/i.exec(line);
      const st = m && INF_KEYS[m[1].toLowerCase()];
      if (st && IMG_EXT.test(m![2])) map.set(baseOf(m![2]).toLowerCase(), st);
    }
  }
  return map;
}

export interface CursorMatch { state: CursorState; cand: Cand }
export interface MatchResult { matched: CursorMatch[]; skipped: string[] }

/** 파일들을 칸에 맞춘다 — 같은 칸에 여러 개면 .ani > .cur > 그림 순으로 하나만 쓰고 나머지는 건너뜀 */
export async function matchCursors(cands: Cand[]): Promise<MatchResult> {
  const inf = await infMap(cands);
  const best = new Map<CursorState, Cand>();
  const skipped: string[] = [];
  for (const c of cands) {
    if (!IMG_EXT.test(c.file.name)) continue;
    const st = inf.get(c.file.name.toLowerCase()) ?? stateByName(c.path);
    if (!st) { skipped.push(`${baseOf(c.path)} (이름으로 칸을 못 찾음)`); continue; }
    const cur = best.get(st);
    if (!cur) { best.set(st, c); continue; }
    const better = (EXT_RANK[extOf(c.file.name)] ?? 9) < (EXT_RANK[extOf(cur.file.name)] ?? 9);
    skipped.push(`${baseOf((better ? cur : c).path)} (같은 칸에 더 알맞은 파일이 있음)`);
    if (better) best.set(st, c);
  }
  return { matched: [...best].map(([state, cand]) => ({ state, cand })), skipped };
}
