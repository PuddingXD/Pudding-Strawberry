// 타임라인 → PNG 저장 (라이브러리 없이 캔버스로 직접 그린다)
//  · 화면에 보이는 타임라인(.tl-list)의 칸 위치·글꼴·색을 그대로 읽어 같은 모양으로 그린다
//  · 페이지에 이미 불러온 글꼴을 쓰므로 자관 본문 폰트가 이미지에도 그대로 나온다
const SCALE = 2;      // 선명하게 (2배)
const PAD = 28;       // 이미지 바깥 여백(px)

type Cs = CSSStyleDeclaration;
const fontOf = (cs: Cs) => `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

/** 글자를 칸 너비에 맞춰 줄바꿈 — 줄바꿈 문자 유지, 띄어쓰기 단위로 넘기고 너무 긴 낱말은 글자 단위로 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/(?<=\s)/)) {
      const test = line + word;
      if (ctx.measureText(test.trimEnd()).width <= maxW || !line) {
        if (ctx.measureText(word.trimEnd()).width > maxW) {
          // 한 낱말이 칸보다 길면 글자 단위
          let cur = line;
          for (const ch of word) {
            if (ctx.measureText(cur + ch).width > maxW && cur) { out.push(cur.trimEnd()); cur = ''; }
            cur += ch;
          }
          line = cur;
        } else line = test;
      } else { out.push(line.trimEnd()); line = word; }
    }
    out.push(line.trimEnd());
  }
  return out;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y); ctx.lineTo(x + w - tr, y); ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br); ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h); ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl); ctx.arcTo(x, y, x + tl, y, tl); ctx.closePath();
}

const solid = (c: string) => {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return false;
  const p = m[1].split(',').map(s => parseFloat(s));
  return p.length < 4 || p[3] > 0.9;
};

export async function exportTimelinePng(list: HTMLElement, filename: string): Promise<boolean> {
  try { await document.fonts?.ready; } catch { /* 무시 */ }
  const lr = list.getBoundingClientRect();
  if (lr.width < 10 || lr.height < 10) return false;

  const panel = list.closest('.panel') as HTMLElement | null;
  const pbg = panel ? getComputedStyle(panel).backgroundColor : '';
  const bg = solid(pbg) ? pbg : '#ffffff';

  const W = Math.ceil(lr.width) + PAD * 2, H = Math.ceil(lr.height) + PAD * 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE; canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  const ox = PAD - lr.left, oy = PAD - lr.top;   // 화면 좌표 → 이미지 좌표

  // 가운데 선
  const lineCs = getComputedStyle(list, '::before');
  if (lineCs.backgroundColor) {
    ctx.fillStyle = lineCs.backgroundColor as string;
    ctx.fillRect(PAD + lr.width / 2 - 1, PAD, 2, lr.height);
  }

  // 원
  list.querySelectorAll<HTMLElement>('.tl-dot').forEach(d => {
    const r = d.getBoundingClientRect(), cs = getComputedStyle(d);
    const cx = r.left + ox + r.width / 2, cy = r.top + oy + r.height / 2, rad = r.width / 2;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, rad + 4, 0, Math.PI * 2); ctx.fill();   // 선과 구분되는 테두리
    const cols = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) ?? []);
    if (cs.backgroundImage.includes('gradient') && cols.length >= 2) {
      ctx.fillStyle = cols[0] as string; ctx.beginPath(); ctx.arc(cx, cy, rad, Math.PI / 2, Math.PI * 1.5); ctx.fill();   // 왼쪽 반
      ctx.fillStyle = cols[1] as string; ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2, Math.PI / 2); ctx.fill();    // 오른쪽 반
    } else {
      ctx.fillStyle = cs.backgroundColor; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    }
  });

  // 글 (시기·사건·설명)
  const drawText = (el: HTMLElement, text: string, x: number, w: number, y: number, align: 'left' | 'right') => {
    const cs = getComputedStyle(el);
    ctx.font = fontOf(cs);
    ctx.fillStyle = cs.color;
    const ls = parseFloat(cs.letterSpacing);
    (ctx as unknown as { letterSpacing: string }).letterSpacing = Number.isFinite(ls) ? `${ls}px` : '0px';
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    const fs = parseFloat(cs.fontSize);
    const lines = wrap(ctx, text, w);
    lines.forEach((ln, i) => {
      const tw = ctx.measureText(ln).width;
      ctx.fillText(ln, align === 'right' ? x + w - tw : x, y + i * lh + (lh - fs) / 2);
    });
    return lines.length * lh;
  };

  list.querySelectorAll<HTMLElement>('.tl-cell').forEach(cell => {
    const right = cell.classList.contains('l');   // 왼쪽 열 = 오른쪽 정렬
    const ccs = getComputedStyle(cell);
    cell.querySelectorAll<HTMLElement>('.era,.ttl,.desc,.bub').forEach(el => {
      const r = el.getBoundingClientRect();
      if (el.classList.contains('bub')) {
        const cs = getComputedStyle(el);
        const pl = parseFloat(cs.paddingLeft), pt = parseFloat(cs.paddingTop), pr = parseFloat(cs.paddingRight);
        const x = r.left + ox, y = r.top + oy;
        const rad = (v: string) => parseFloat(v) || 0;
        rr(ctx, x, y, r.width, r.height, rad(cs.borderTopLeftRadius), rad(cs.borderTopRightRadius), rad(cs.borderBottomRightRadius), rad(cs.borderBottomLeftRadius));
        ctx.fillStyle = cs.backgroundColor; ctx.fill();
        ctx.strokeStyle = cs.borderTopColor; ctx.lineWidth = 1; ctx.stroke();
        drawText(el, el.textContent ?? '', x + pl, r.width - pl - pr, y + pt, 'left');
      } else {
        const pad = parseFloat(right ? ccs.paddingRight : ccs.paddingLeft) || 0;
        const colW = cell.getBoundingClientRect().width - pad;
        const colX = cell.getBoundingClientRect().left + ox + (right ? 0 : pad);
        drawText(el, el.textContent ?? '', colX, colW, r.top + oy, right ? 'right' : 'left');
      }
    });
  });

  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
