// 자관(페이지) 배경을 따로 정했을 때 왼쪽 메뉴 글씨가 배경에 묻히지 않게 — 배경과의 대비를 재서 글씨 밝기만 조정한다.
// (팔레트는 포인트 컬러에서 「밝기 고정」으로 만들어지는데, 배경만 다른 색으로 바꾸면 둘이 따로 놀아 중간 톤에서 묻힌다)
type RGB = [number, number, number];

export function parseHex(v: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
}
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: RGB, b: RGB) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const toHex = (c: RGB) => '#' + c.map(n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('');
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t) as RGB;

/** 글씨색 fg를 배경 bg 위에서 min 이상의 대비가 되도록 — 원래 색상(색조)은 살리고 검정/흰색 쪽으로 섞는다 */
export function ensureContrast(fg: string, bgs: RGB[], min: number): string {
  const f = parseHex(fg);
  if (!f) return fg;
  const worst = (c: RGB) => Math.min(...bgs.map(b => ratio(c, b)));
  if (worst(f) >= min) return fg;
  const white: RGB = [255, 255, 255], black: RGB = [18, 20, 26];
  // 두 방향 중 더 잘 보이는 쪽
  const dir = worst(white) >= worst(black) ? white : black;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(f, dir, t);
    if (worst(c) >= min) return toHex(c);
  }
  return toHex(dir);
}
