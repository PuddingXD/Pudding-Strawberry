// 커서 그림이 브라우저 한계(128px)를 넘을 때 쓸 수 있게 줄인다 — 넘으면 브라우저가 커서를 무시하고 기본 커서로 되돌린다.
// 윈도우 .cur/.ico는 여러 크기(32·48·…·256)가 한 파일에 들어 있어, 큰 것만 걸러내면 된다.
// 작은 크기가 하나도 없으면(256만 있는 경우) 캔버스로 48px PNG로 줄이고 핫스팟도 같은 비율로 옮긴다.

export interface FitResult { blob: Blob; hs: string } // hs: CSS cursor에 붙일 「 x y」 — .cur로 남으면 빈 문자열

const LIMIT = 128;
const PREFER = 64;
const SMALL = 48;

const isIcoLike = (buf: ArrayBuffer) => {
  if (buf.byteLength < 22) return false;
  const dv = new DataView(buf);
  const t = dv.getUint16(2, true);
  return dv.getUint16(0, true) === 0 && (t === 1 || t === 2) && dv.getUint16(4, true) > 0;
};

interface Ent { w: number; h: number; hx: number; hy: number; size: number; off: number }

function entries(buf: ArrayBuffer): Ent[] {
  const dv = new DataView(buf);
  const n = dv.getUint16(4, true);
  const out: Ent[] = [];
  for (let i = 0; i < n; i++) {
    const p = 6 + 16 * i;
    if (p + 16 > buf.byteLength) break;
    const size = dv.getUint32(p + 8, true);
    const off = dv.getUint32(p + 12, true);
    if (off + size > buf.byteLength) continue;
    out.push({ w: dv.getUint8(p) || 256, h: dv.getUint8(p + 1) || 256, hx: dv.getUint16(p + 4, true), hy: dv.getUint16(p + 6, true), size, off });
  }
  return out;
}

export async function fitCurBlob(blob: Blob): Promise<FitResult> {
  let buf: ArrayBuffer;
  try { buf = await blob.arrayBuffer(); } catch { return { blob, hs: '' }; }
  if (!isIcoLike(buf)) return { blob, hs: '__keep__' };
  const isCursor = new DataView(buf).getUint16(2, true) === 2;
  const all = entries(buf);
  if (!all.length) return { blob, hs: isCursor ? '' : '__keep__' };
  const dim = (e: Ent) => Math.max(e.w, e.h);
  if (all.every(e => dim(e) <= LIMIT)) return { blob, hs: isCursor ? '' : '__keep__' };   // 이미 괜찮음

  let keep = all.filter(e => dim(e) <= PREFER);
  if (!keep.length) keep = all.filter(e => dim(e) <= LIMIT);
  if (keep.length) {
    // 작은 크기만 남겨 다시 묶는다 (그림 데이터는 그대로 복사)
    const head = 6 + 16 * keep.length;
    const total = head + keep.reduce((a, e) => a + e.size, 0);
    const out = new Uint8Array(total);
    const src = new Uint8Array(buf);
    const dv = new DataView(out.buffer);
    out.set(src.subarray(0, 4), 0);
    dv.setUint16(4, keep.length, true);
    let pos = head;
    keep.forEach((e, i) => {
      const p = 6 + 16 * i;
      const orig = all.indexOf(e);
      out.set(src.subarray(6 + 16 * orig, 6 + 16 * orig + 16), p);
      dv.setUint32(p + 12, pos, true);
      out.set(src.subarray(e.off, e.off + e.size), pos);
      pos += e.size;
    });
    return { blob: new Blob([out], { type: isCursor ? 'image/x-icon' : 'image/x-icon' }), hs: isCursor ? '' : '__keep__' };
  }

  // 큰 크기뿐 — 그려서 줄인다
  const big = all.reduce((a, e) => (dim(e) > dim(a) ? a : e), all[0]);   // 가장 작은 것
  try {
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    URL.revokeObjectURL(url);
    const k = SMALL / Math.max(img.naturalWidth, img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const png = await new Promise<Blob | null>(res => cv.toBlob(res, 'image/png'));
    if (!png) return { blob, hs: '' };
    const hx = isCursor ? Math.min(w - 1, Math.round(big.hx * (w / big.w))) : 0;
    const hy = isCursor ? Math.min(h - 1, Math.round(big.hy * (h / big.h))) : 0;
    return { blob: png, hs: ` ${hx} ${hy}` };
  } catch { return { blob, hs: '' }; }
}
