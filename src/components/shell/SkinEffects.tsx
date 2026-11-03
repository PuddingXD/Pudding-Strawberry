'use client';
// B 디자인에서 가져온 꾸미기 효과 — 환경설정 > 효과·입장 화면 (lib/skinStore)
//   · 입장 화면: 메인(/)에 처음 들어오면 화면 전체를 덮고, 누르면 사라진다
//   · 떨어지는 효과: 화면 뒤쪽 캔버스에 별·하트·눈송이 등이 천천히 내려온다
//   · 마우스 효과: 지나간 자리에 조각이 반짝이며 떨어진다 (PC만)
//   · 클릭음: 어디를 누르든 짧은 소리 (파일을 안 올리면 기본 "톡")
//   · 메뉴선 색: 왼쪽 메뉴 세로선 그라데이션 3색
import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSkinSettings, type FxShape } from '@/lib/skinStore';
import { useSiteSettings } from '@/lib/siteStore';
import { useBlobUrl } from '@/lib/blobStore';

type Ctx = CanvasRenderingContext2D;

/** 모양 하나 그리기 — 원점(0,0) 기준, r = 반지름 */
function shapePath(ctx: Ctx, shape: FxShape, r: number) {
  ctx.beginPath();
  if (shape === 'circle') { ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); return; }
  if (shape === 'star' || shape === 'sparkle') {
    const n = shape === 'star' ? 5 : 4;
    const inner = shape === 'star' ? r / 2.4 : r * 0.22;
    for (let k = 0; k < n * 2; k++) {
      const rr = k % 2 === 0 ? r : inner;
      const a = (Math.PI / n) * k - Math.PI / 2;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); return;
  }
  if (shape === 'heart') {
    const h = r * 0.75;
    ctx.moveTo(0, h * 0.6);
    ctx.bezierCurveTo(h * 1.6, -h * 0.9, h * 0.4, -h * 2, 0, -h * 0.6);
    ctx.bezierCurveTo(-h * 0.4, -h * 2, -h * 1.6, -h * 0.9, 0, h * 0.6);
    ctx.closePath(); return;
  }
  if (shape === 'petal') {
    ctx.ellipse(0, 0, r * 0.45, r, 0, 0, Math.PI * 2);
    return;
  }
  // snow — 여섯 갈래 선 (선으로 그리므로 fill 대신 stroke)
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
}
function paint(ctx: Ctx, shape: FxShape, color: string) {
  if (shape === 'snow') { ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.stroke(); }
  else { ctx.fillStyle = color; ctx.fill(); }
}
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function fitCanvas(c: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  c.style.width = `${W}px`; c.style.height = `${H}px`;
  c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W, H };
}

/* ---------- 떨어지는 효과 ---------- */
function Particles({ shape, color, count, speed, size }: { shape: FxShape; color: string; count: number; speed: number; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c || reduced()) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let { W, H } = fitCanvas(c);
    const onResize = () => { ({ W, H } = fitCanvas(c)); };
    window.addEventListener('resize', onResize);
    const make = (fresh: boolean) => ({
      x: rand(0, W), y: fresh ? rand(0, H) : rand(-40, -4), s: rand(size * 0.55, size),
      vy: rand(0.55, 1) * speed * 0.4 + 0.25, vx: rand(-0.35, 0.35),
      rot: rand(0, Math.PI * 2), vr: rand(-0.02, 0.02), op: rand(0.45, 0.95), sway: rand(0, Math.PI * 2),
    });
    const ps = Array.from({ length: Math.max(1, Math.min(150, count)) }, () => make(true));
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.visibilityState !== 'visible') return;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.y += p.vy; p.sway += 0.012; p.x += p.vx + Math.sin(p.sway) * 0.3; p.rot += p.vr;
        if (p.y - p.s > H) { ps[i] = make(false); continue; }
        if (p.x < -30) p.x = W + 30; else if (p.x > W + 30) p.x = -30;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.op;
        shapePath(ctx, shape, p.s / 2); paint(ctx, shape, color);
        ctx.restore();
      }
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [shape, color, count, speed, size]);
  return <canvas ref={ref} className="fx-particles" aria-hidden />;
}

/* ---------- 마우스 효과 ---------- */
function Trail({ shape, color, color2, size, amount, life }: { shape: FxShape; color: string; color2: string; size: number; amount: number; life: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c || reduced()) return;
    if (window.matchMedia?.('(pointer: coarse)').matches) return;   // 터치 화면은 끈다
    const ctx = c.getContext('2d'); if (!ctx) return;
    let { W, H } = fitCanvas(c);
    const onResize = () => { ({ W, H } = fitCanvas(c)); };
    window.addEventListener('resize', onResize);
    type P = { x: number; y: number; vx: number; vy: number; g: number; s: number; rot: number; vr: number; t: number; life: number; c: string };
    const parts: P[] = [];
    let raf = 0, lx: number | null = null, ly = 0, acc = 0;
    const step = Math.max(5, 24 - amount * 2);
    const lifeBase = 30 + life * 12;
    const spawn = (x: number, y: number) => {
      if (parts.length > 220) parts.shift();
      parts.push({
        x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-0.7, 0.7), vy: rand(-0.4, 0.6), g: 0.03 + life * 0.002,
        s: rand(size * 0.55, size), rot: rand(0, Math.PI * 2), vr: rand(-0.08, 0.08), t: 0,
        life: rand(lifeBase * 0.7, lifeBase * 1.2), c: color2 && Math.random() < 0.5 ? color2 : color,
      });
    };
    const tick = () => {
      raf = 0;
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t++;
        if (p.t >= p.life) { parts.splice(i, 1); continue; }
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        const f = p.t / p.life;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, 1 - f * f);
        shapePath(ctx, shape, (p.s / 2) * (1 - f * 0.35)); paint(ctx, shape, p.c);
        ctx.restore();
      }
      if (parts.length) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: MouseEvent) => {
      const x = e.clientX, y = e.clientY;
      if (lx === null) { lx = x; ly = y; return; }
      const dx = x - lx, dy = y - ly;
      acc += Math.sqrt(dx * dx + dy * dy);
      if (acc >= step) {
        const n = Math.min(6, Math.floor(acc / step));
        for (let i = 1; i <= n; i++) spawn(lx + dx * (i / n), ly + dy * (i / n));
        acc -= n * step;
        if (!raf) raf = requestAnimationFrame(tick);
      }
      lx = x; ly = y;
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(raf); document.removeEventListener('mousemove', onMove); window.removeEventListener('resize', onResize); };
  }, [shape, color, color2, size, amount, life]);
  return <canvas ref={ref} className="fx-trail" aria-hidden />;
}

/* ---------- 클릭음 ---------- */
function ClickSound({ file, volume }: { file: string; volume: number }) {
  const src = useBlobUrl(file || undefined);
  useEffect(() => {
    const vol = Math.min(1, Math.max(0.01, volume / 100));
    let play: () => void;
    if (src) {
      const pool = Array.from({ length: 5 }, () => { const a = new Audio(src); a.preload = 'auto'; a.volume = vol; return a; });
      let i = 0;
      play = () => {
        const a = pool[i]; i = (i + 1) % pool.length;
        try { a.currentTime = 0; void a.play().catch(() => { /* 자동재생 차단 시 조용히 */ }); } catch { /* 무시 */ }
      };
    } else {
      // 파일이 없으면 짧은 "톡" 소리를 직접 만든다
      let ac: AudioContext | null = null;
      play = () => {
        try {
          ac = ac ?? new AudioContext();
          const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
          o.type = 'sine'; o.frequency.setValueAtTime(1150, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.06);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
          o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.1);
        } catch { /* 무시 */ }
      };
    }
    const onClick = () => play();
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [src, volume]);
  return null;
}

/* ---------- 입장 화면 ---------- */
const LANDING_SEEN = 'ohome.landing.seen';
function Landing() {
  const [st] = useSkinSettings();
  const [site] = useSiteSettings();
  const L = st.landing;
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const bg = useBlobUrl(L.bgImg || undefined);
  const logo = useBlobUrl(L.logo || undefined);
  useEffect(() => {
    if (!L.on || pathname !== '/') { setShow(false); return; }
    let seen = false;
    try { seen = !L.every && sessionStorage.getItem(LANDING_SEEN) === '1'; } catch { /* 무시 */ }
    setShow(!seen);
  }, [L.on, L.every, pathname]);
  if (!show) return null;
  const enter = () => {
    try { sessionStorage.setItem(LANDING_SEEN, '1'); } catch { /* 무시 */ }
    setLeaving(true);
    setTimeout(() => { setShow(false); setLeaving(false); }, 450);
  };
  const layers: string[] = [];
  if (bg) layers.push(`url("${bg}") center/cover no-repeat`);
  if (L.bgColor && L.bgColor2) layers.push(`linear-gradient(var(--bg-angle,180deg),${L.bgColor},${L.bgColor2})`);
  const style: React.CSSProperties = {
    background: layers.length ? layers.join(',') : undefined,
    backgroundColor: L.bgColor || undefined,
    color: L.ink || undefined,
  };
  return (
    <div className={`landing-ov ${leaving ? 'out' : ''}`} style={style} onClick={enter} role="button" aria-label="입장하기" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') enter(); }}>
      <div className="land-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} alt={site.title} style={{ width: Math.max(40, Math.min(2000, L.logoW)) }} draggable={false} />
          : <span className="land-title">{site.title}</span>}
        {L.caption && <span className="land-cap">{L.caption}</span>}
      </div>
    </div>
  );
}

/* ---------- 묶음 ---------- */
export function SkinEffects() {
  const [st] = useSkinSettings();
  // 메뉴선 색 — 정한 것만 덮고, 비운 칸은 skin.css의 자동값(포인트 컬러 등)을 그대로 쓴다
  useEffect(() => {
    const root = document.documentElement.style;
    const set = (k: string, v: string) => (/^#[0-9a-fA-F]{3,8}$/.test(v) ? root.setProperty(k, v) : root.removeProperty(k));
    set('--rail-c1', st.railC1); set('--rail-c2', st.railC2); set('--rail-c3', st.railC3);
  }, [st.railC1, st.railC2, st.railC3]);
  // 게시판 본문 카드 테두리 끄기 (사용자 요청) — <html>에 표시만 하고 모양은 skin.css(.body-card)
  useEffect(() => {
    document.documentElement.classList.toggle('no-card-bd', !st.cardBorder);
  }, [st.cardBorder]);
  const P = st.particles, T = st.trail, C = st.click;
  return (
    <>
      {P.on && <Particles shape={P.shape} color={P.color} count={P.count} speed={P.speed} size={P.size} />}
      {T.on && <Trail shape={T.shape} color={T.color} color2={T.color2} size={T.size} amount={T.amount} life={T.life} />}
      {C.on && <ClickSound file={C.file} volume={C.volume} />}
      <Landing />
    </>
  );
}
