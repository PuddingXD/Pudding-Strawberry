// 글이 올라온 순서를 흔들리지 않게 — 시각·id·정렬 비교를 한곳에서.
//
// 섞이던 원인: ① 같은 밀리초에 만든 글은 시각(date)이 같아 선후를 알 수 없었고 (id 뒤 4자리는 무작위),
// ② 서버에 저장된 순번(sort)이 겹치면(두 사람이 거의 동시에 저장 등) DB가 겹친 항목을 매번 다른 순서로 돌려줬다.
// → 여기서 「한 번 정해지면 절대 안 겹치는 시각·id」를 만들고, 겹친 순번은 생성 순으로 가른다.

let lastMs = 0;
let seq = 0;

/** 단조 증가하는 현재 시각(ms) — 같은 밀리초에 여러 번 불러도 항상 1ms씩 커진다 */
export function monoNow(): number {
  const n = Date.now();
  lastMs = n > lastMs ? n : lastMs + 1;
  return lastMs;
}

/** 새 글에 찍는 생성 시각 (ISO, ms까지) — new Date().toISOString() 대신 쓴다. 같은 화면에서 만든 글은 절대 겹치지 않는다 */
export const nowIso = (): string => new Date(monoNow()).toISOString();

/** 새 id — 앞부분이 생성 시각(36진수 고정 폭)이라 id만 비교해도 만든 순서대로 정렬된다.
 *  (기존 id와 형식이 같다: 36진수 시각 8자 + 뒤 4자. 뒤 4자는 이제 같은 ms 안의 순번 + 무작위) */
export function sortableId(): string {
  const t = monoNow().toString(36).padStart(8, '0');
  seq = (seq + 1) % 1296;   // 36^2
  return t + seq.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 4).padEnd(2, '0');
}

type Stamped = { id: string; date?: string; createdAt?: string; created?: string };

/** 항목이 만들어진 시각 문자열 — 종류마다 필드 이름이 달라 가장 알맞은 것을 고른다 */
export const createdOf = (it: Stamped): string => it.createdAt || it.created || it.date || '';

/** 최신이 먼저 오는 비교 — 시각이 같으면 id로 (id는 생성 순으로 커진다) */
export function newestCmp(a: Stamped, b: Stamped): number {
  const ca = createdOf(a), cb = createdOf(b);
  if (ca !== cb) return ca < cb ? 1 : -1;
  return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
}

/** 새 글이 목록 **앞**에 들어가는 컬렉션 — 순번이 겹쳤을 때 최신을 앞에 둔다. 나머지(뒤에 붙는 것)는 최신이 뒤 */
const PREPEND = new Set([
  'posts', 'gallery', 'feed', 'roadview', 'trpg_logs', 'trpg_chars', 'dotori', 'rp_rooms', 'threads',
  'diary', 'trpg_reviews',
]);

/** 서버에서 받은 목록을 안정적으로 정렬 — 저장된 순번(sort)대로, 겹치면 생성 순으로 (두 백엔드 공용) */
export function stableRows<T extends Stamped>(coll: string, rows: { sort: number; item: T }[]): T[] {
  const newestFirst = PREPEND.has(coll);
  return [...rows]
    .sort((x, y) => (x.sort - y.sort) || (newestFirst ? newestCmp(x.item, y.item) : -newestCmp(x.item, y.item)))
    .map(r => r.item);
}
