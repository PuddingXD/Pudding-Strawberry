// 타임라인 → PNG 저장 (라이브러리 없이 캔버스로 직접 그린다)
//  · 화면에 보이는 타임라인(.tl-list)의 칸 위치·글꼴·색을 그대로 읽어 같은 모양으로 그린다
//  · 페이지에 이미 불러온 글꼴을 쓰므로 자관 본문 폰트가 이미지에도 그대로 나온다
const SCALE = 2;      // 선명하게 (2배)
const MARGIN = 40;    // 바깥 배경 여백(px)
const PADX = 44;      // 카드 안쪽 좌우 여백
const HEAD_H = 84;    // 카드 윗줄(이름·제목) 높이
const FOOT_H = 0;     // (범례 제거 — 아랫줄 없음)
const BODY_PAD = 36;  // 타임라인 위·아래 여백

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


// ── 내보내기 옵션 ──
export interface PngPerson { name: string; font?: string }   // font: 그 캐릭터의 이름 글꼴(CSS font-family)
export interface PngOpts {
  title: string;                 // 가운데 제목 (예: MEMORY)
  left?: PngPerson; right?: PngPerson;   // 페어일 때 양 끝 이름 (다인관은 생략)
  theme: string;                 // 페어(자관) 테마색 — 배경을 이 색의 옅은 톤으로
  bgStrength: number;            // 배경에 섞는 테마색 비율 0.1~0.6
  stickers: boolean;             // 스티커도 함께 내보내기
  header?: { url: string; height: number; zoom: number; px: number; py: number };
}

/** 헤더 이미지를 영역에 꽉 채워 그린다(cover) — zoom 1 = 딱 맞게, px/py = 어느 부분을 보일지 0~1. 미리보기도 같은 함수 */
export function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number },
  x: number, y: number, w: number, h: number, zoom: number, px: number, py: number) {
  const iw = (img as HTMLImageElement).naturalWidth || img.width, ih = (img as HTMLImageElement).naturalHeight || img.height;
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih) * Math.max(1, zoom);
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, x - (dw - w) * px, y - (dh - h) * py, dw, dh);
}

export function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

/** 이미지를 "내 쪽 파일"로 불러온다 — 저장소 주소(https)를 그대로 캔버스에 그리면 보안상 캔버스가 잠겨
 *  PNG를 만들 수 없으므로(저장 단계에서 멈춤), 받아서 blob으로 바꾼 뒤 그린다. 실패하면 null(그 이미지는 생략) */
export async function loadLocalImg(url: string): Promise<HTMLImageElement | null> {
  try {
    if (/^(blob:|data:)/.test(url)) return await loadImg(url);
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const u = URL.createObjectURL(await r.blob());
    const im = await loadImg(u);
    setTimeout(() => URL.revokeObjectURL(u), 10000);
    return im;
  } catch { return null; }
}

/** CSS 색(hex·rgb·var 해석 포함)을 [r,g,b]로 */
function rgbOf(c: string): [number, number, number] {
  const el = document.createElement('span');
  el.style.color = c || '#c96a73';
  document.body.appendChild(el);
  const v = getComputedStyle(el).color;
  el.remove();
  const m = v.match(/[\d.]+/g)?.map(Number) ?? [201, 106, 115];
  return [m[0], m[1], m[2]];
}
const mixWhite = (c: [number, number, number], k: number) =>
  `rgb(${c.map(v => Math.round(v * k + 255 * (1 - k))).join(',')})`;

export async function exportTimelinePng(list: HTMLElement, filename: string, o: PngOpts): Promise<boolean> {
  try { await document.fonts?.ready; } catch { /* 무시 */ }
  const lr = list.getBoundingClientRect();
  if (lr.width < 10 || lr.height < 10) return false;

  const hdrImg = o.header ? await loadLocalImg(o.header.url) : null;
  const hh = hdrImg && o.header ? Math.round(o.header.height) : 0;
  const CARD = '#ffffff';

  // 카드 크기 (레이아웃 좌표: 카드 왼쪽 위 = MARGIN,MARGIN)
  const cardW = Math.ceil(lr.width) + PADX * 2;
  const cardH = HEAD_H + hh + BODY_PAD + Math.ceil(lr.height) + BODY_PAD + FOOT_H;
  const LX = MARGIN + PADX, LY = MARGIN + HEAD_H + hh + BODY_PAD;   // 타임라인 왼쪽 위

  // 스티커 — 타임라인 칸 기준 상대 위치를 그대로 옮긴다 (카드 밖으로 나온 것도 바깥 배경 위에 그려짐)
  type St = { im: HTMLImageElement; cx: number; cy: number; w: number; h: number; rot: number };
  const sts: St[] = [];
  const stSrc: { el: HTMLElement; im: HTMLImageElement }[] = [];
  let minX = 0, minY = 0, maxX = cardW + MARGIN * 2, maxY = cardH + MARGIN * 2;
  if (o.stickers) {
    document.querySelectorAll<HTMLElement>('[data-sticker]').forEach(el => {
      const im = el.querySelector('img');
      const par = el.offsetParent as HTMLElement | null;
      if (!im || !par || !el.offsetWidth || !im.complete || !im.naturalWidth) return;
      const pr = par.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight;
      const cxp = pr.left + el.offsetLeft + w / 2, cyp = pr.top + el.offsetTop + h / 2;
      const rot = parseFloat(el.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] ?? '0') * Math.PI / 180;
      const bw = Math.abs(w * Math.cos(rot)) + Math.abs(h * Math.sin(rot));
      const bh = Math.abs(w * Math.sin(rot)) + Math.abs(h * Math.cos(rot));
      const cx = LX + (cxp - lr.left), cy = LY + (cyp - lr.top);
      // 타임라인 주변(160px)에 걸친 것만
      if (cx + bw / 2 < LX - 160 || cx - bw / 2 > LX + lr.width + 160 || cy + bh / 2 < LY - 160 || cy - bh / 2 > LY + lr.height + 160) return;
      stSrc.push({ el, im });
      sts.push({ im, cx, cy, w, h, rot });
      minX = Math.min(minX, cx - bw / 2 - 20); maxX = Math.max(maxX, cx + bw / 2 + 20);
      minY = Math.min(minY, cy - bh / 2 - 20); maxY = Math.max(maxY, cy + bh / 2 + 20);
    });
  }

  // 스티커 이미지도 내 쪽 파일로 교체 (못 받으면 그 스티커만 뺀다)
  const local = await Promise.all(sts.map((s, i) => loadLocalImg(stSrc[i].im.currentSrc || stSrc[i].im.src)));
  for (let i = sts.length - 1; i >= 0; i--) { const li = local[i]; if (li) sts[i].im = li; else sts.splice(i, 1); }

  const W = Math.ceil(maxX - minX), H = Math.ceil(maxY - minY);
  if (W * SCALE > 16000 || H * SCALE > 16000) return false;   // 너무 큰 이미지는 브라우저가 못 만든다
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE; canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'top';
  ctx.fillStyle = mixWhite(rgbOf(o.theme), Math.max(0.05, Math.min(0.8, o.bgStrength)));
  ctx.fillRect(0, 0, W, H);
  ctx.translate(-minX, -minY);
  const bodyCs = getComputedStyle(list);
  const fam = bodyCs.fontFamily;

  // 둥근 카드 + 은은한 그림자
  ctx.save();
  ctx.shadowColor = 'rgba(40,40,60,.10)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 10;
  rr(ctx, MARGIN, MARGIN, cardW, cardH, 28, 28, 28, 28);
  ctx.fillStyle = CARD; ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, MARGIN, MARGIN, cardW, cardH, 28, 28, 28, 28);
  ctx.clip();

  // 윗줄 — 이름(양 끝, 각 캐릭터의 이름 글꼴) · 제목(가운데, 이름보다 크게)
  //  이름 크기: 글자 수가 달라도 비슷한 너비로 보이게 자동 조절 (같은 글꼴 크기일 필요는 없다)
  const people = [o.left && { p: o.left, side: 'l' as const }, o.right && { p: o.right, side: 'r' as const }]
    .filter((x): x is { p: PngPerson; side: 'l' | 'r' } => !!x);
  for (const { p } of people) {
    try { await document.fonts?.load(`700 20px ${p.font || fam}`, p.name); } catch { /* 무시 */ }
  }
  const TARGET = Math.min(170, cardW * 0.22);
  const sized = people.map(({ p, side }) => {
    ctx.font = `700 20px ${p.font || fam}`;
    const w20 = ctx.measureText(p.name).width || 1;
    return { p, side, size: Math.max(15, Math.min(30, (TARGET / w20) * 20)) };
  });
  const nameMax = sized.reduce((m, s) => Math.max(m, s.size), 18);
  for (const { p, side, size } of sized) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
    ctx.font = `700 ${size}px ${p.font || fam}`;
    ctx.fillStyle = '#222';
    ctx.textAlign = side === 'l' ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.name, side === 'l' ? MARGIN + 36 : MARGIN + cardW - 36, MARGIN + HEAD_H / 2 + 1);
  }
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  if (o.title) {
    const ts = Math.min(46, Math.max(30, nameMax * 1.5));   // 이름보다 항상 크게
    ctx.textAlign = 'center'; ctx.fillStyle = '#2a2d33'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${ts}px "Cormorant Garamond", "Playfair Display", Georgia, serif`;
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '4px';
    ctx.fillText(o.title.toUpperCase(), MARGIN + cardW / 2 + 2, MARGIN + HEAD_H / 2 + 1);
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  }
  ctx.fillStyle = '#eceef1'; ctx.fillRect(MARGIN, MARGIN + HEAD_H - 1, cardW, 1);

  // 헤더 이미지
  if (hdrImg && o.header && hh > 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(MARGIN, MARGIN + HEAD_H, cardW, hh); ctx.clip();
    drawCover(ctx, hdrImg, MARGIN, MARGIN + HEAD_H, cardW, hh, o.header.zoom, o.header.px, o.header.py);
    ctx.restore();
    ctx.fillStyle = '#e4e6ea'; ctx.fillRect(MARGIN, MARGIN + HEAD_H + hh, cardW, 1);
  }

  // 타임라인 본체 — 화면 좌표를 카드 안 좌표로
  const ox = LX - lr.left, oy = LY - lr.top;
  const bg = CARD;

  // 가운데 선
  const lineCs = getComputedStyle(list, '::before');
  if (lineCs.backgroundColor) {
    ctx.fillStyle = lineCs.backgroundColor as string;
    ctx.fillRect(LX + lr.width / 2 - 1, LY, 2, lr.height);
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

  ctx.restore();   // 카드 클립 해제

  // 스티커 (맨 위)
  for (const s of sts) {
    ctx.save();
    ctx.translate(s.cx, s.cy);
    if (s.rot) ctx.rotate(s.rot);
    ctx.drawImage(s.im, -s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
  }

  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
