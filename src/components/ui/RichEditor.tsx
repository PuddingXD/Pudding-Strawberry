'use client';
// 리치 텍스트 에디터 (TipTap) — 프로필 탭 등 HTML 콘텐츠 작성용
// 자체 스타일 툴바 (7장 — 기본 UI 금지) · 출력은 HTML, 저장 시 새니타이즈는 렌더 쪽에서 (6.3)
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Plugin } from '@tiptap/pm/state';
import { TableMap, CellSelection } from '@tiptap/pm/tables';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { putBlob } from '@/lib/blobStore';
import { useToast } from '@/components/ui/Toast';
import { useFonts } from '@/lib/fontStore';

/* ───────── 표 확장 — 셀 배경색·세로 정렬 · 행 높이 · 표 정렬을 저장 가능하게 ───────── */
const MAX_TABLE = 10;   // 표 최대 10 × 10
const EDGES: [string, string][] = [
  ['borderTop', 'border-top'], ['borderRight', 'border-right'], ['borderBottom', 'border-bottom'], ['borderLeft', 'border-left'],
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cellAttrs = (parent: any) => ({
  ...(parent ?? {}),
  backgroundColor: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.backgroundColor || null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderHTML: (a: any) => (a.backgroundColor ? { style: `background-color:${a.backgroundColor}` } : {}),
  },
  vAlign: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.verticalAlign || null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderHTML: (a: any) => (a.vAlign ? { style: `vertical-align:${a.vAlign}` } : {}),
  },
  // 칸마다 네 변을 따로 — 값은 「1pt solid #000000」 꼴. 비어 있으면 표 전체의 기본 테두리를 따른다
  ...Object.fromEntries(EDGES.map(([attr, css]) => [attr, {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.getPropertyValue(css).trim() || null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderHTML: (a: any) => (a[attr] ? { style: `${css}:${a[attr]}` } : {}),
  }])),
});
const RCell = TableCell.extend({ addAttributes() { return cellAttrs(this.parent?.()); } });
const RHeader = TableHeader.extend({ addAttributes() { return cellAttrs(this.parent?.()); } });
const RRow = TableRow.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      rowHeight: {
        default: null,
        parseHTML: (el: HTMLElement) => parseInt(el.style.height, 10) || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderHTML: (a: any) => (a.rowHeight ? { style: `height:${a.rowHeight}px` } : {}),
      },
    };
  },
});
/* 표 테두리 — 표 전체에 하나 (기본: 검정 1pt 실선). CSS 변수로 내보내서 편집·읽기 화면이 같은 규칙(td의 border)을 쓴다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tableVars = (a: any): string => {
  const st = String(a.borderStyle ?? 'solid');
  const w0 = Number(a.borderWidth ?? 1) || 1;
  const w = st === 'double' ? Math.max(3, w0) : w0;               // 겹선은 3pt 아래에선 한 줄로 보여서 최소 3pt
  const line = st === 'dashed' ? 'dashed' : st === 'double' ? 'double' : 'solid';
  return `--tb-c:${a.borderColor ?? '#000000'};--tb-w:${w}pt;--tb-s:${line}${st === 'transparent' ? ';--tb-c2:transparent' : ''}`;
};
const RTable = Table.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      borderColor: {
        default: '#000000',
        parseHTML: (el: HTMLElement) => el.style.getPropertyValue('--tb-c').trim() || '#000000',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderHTML: (a: any) => ({ style: tableVars(a) }),   // 세 속성이 한 번에 나가므로 여기서만 낸다
      },
      borderWidth: {
        default: 1,
        parseHTML: (el: HTMLElement) => parseFloat(el.style.getPropertyValue('--tb-w')) || 1,
        renderHTML: () => ({}),
      },
      borderStyle: {
        default: 'solid',
        parseHTML: (el: HTMLElement) => {
          if (el.style.getPropertyValue('--tb-c2').trim() === 'transparent') return 'transparent';
          const s = el.style.getPropertyValue('--tb-s').trim();
          return s === 'dashed' || s === 'double' ? s : 'solid';
        },
        renderHTML: () => ({}),
      },
      tableAlign: {
        default: 'left',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-talign') || 'left',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderHTML: (a: any) => (a.tableAlign && a.tableAlign !== 'left' ? { 'data-talign': a.tableAlign } : {}),
      },
    };
  },
  // 편집 화면의 표는 감싸는 칸(tableWrapper)이 있어서, 정렬 값을 그 칸에도 붙여 준다 (읽기 화면은 table에 직접 붙는다)
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'table' && node.attrs.tableAlign && node.attrs.tableAlign !== 'left') {
                decos.push(Decoration.node(pos, pos + node.nodeSize, { 'data-talign': String(node.attrs.tableAlign) }));
              }
              // 편집 화면은 표를 감싸는 칸이 있어 그 칸에 테두리 변수를 붙인다 (자식 td가 상속)
              if (node.type.name === 'table') {
                decos.push(Decoration.node(pos, pos + node.nodeSize, { style: tableVars(node.attrs) }));
              }
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
}).configure({ resizable: true, cellMinWidth: 40 });

/* 커서가 든 표·행 찾기 — 표 도구 줄(행 높이·균등·정렬)이 쓴다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findAround(state: any, name: string): { node: any; pos: number } | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (n.type.name === name) return { node: n, pos: $from.before(d) };
  }
  return null;
}

const SWATCHES = [
  '#000000', '#434343', '#7f7f7f', '#bfbfbf', '#ffffff', '#e03131', '#f08c00', '#f7d046',
  '#2f9e44', '#1c7ed6', '#7048e8', '#d6336c', '#ffc9c9', '#ffe8cc', '#fff3bf', '#d3f9d8',
  '#d0ebff', '#e5dbff', '#fcc2d7', '#e9ecef',
];

/** 눌러서 여는 작은 팝업 — 화면 맨 위(포털)에 띄워 툴바의 가로 스크롤에 안 잘린다 */
function Pop({ anchor, onClose, children, className }: { anchor: HTMLElement | null; onClose: () => void; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return;
      onClose();
    };
    const onScroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);
  if (!anchor || typeof document === 'undefined') return null;
  const r = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.left, window.innerWidth - 232));
  return createPortal(
    <div ref={ref} className={`re-pop ${className ?? ''}`} style={{ left, top: r.bottom + 6 }} onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>{children}</div>,
    document.body,
  );
}

/** 색 고르기 — 견본 + 직접 고르기 + 해제 */
function ColorBtn({ label, title, current, onPick, onClear }: {
  label: React.ReactNode; title: string; current?: string; onPick: (c: string) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={btn} type="button" data-tip={title} className={`re-btn re-color ${open ? 'on' : ''}`}
        onMouseDown={e => e.preventDefault()} onClick={() => setOpen(o => !o)}>
        <span className="re-color-l">{label}</span>
        <i className="re-color-bar" style={{ background: current || 'transparent' }} />
      </button>
      {open && (
        <Pop anchor={btn.current} onClose={() => setOpen(false)}>
          <div className="re-sw">
            {SWATCHES.map(c => (
              <button key={c} type="button" className="re-sw-i" style={{ background: c }} aria-label={c}
                onClick={() => { onPick(c); setOpen(false); }} />
            ))}
          </div>
          <div className="re-pop-row">
            <label className="re-pop-lbl">직접 고르기
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(current ?? '') ? current : '#000000'}
                onChange={e => onPick(e.target.value)} />
            </label>
            <button type="button" className="re-pop-btn" onClick={() => { onClear(); setOpen(false); }}>해제</button>
          </div>
        </Pop>
      )}
    </>
  );
}

/** 표 넣기 — 칸을 훑어서 크기를 고른다 (최대 10 × 10) */
function TableBtn({ onInsert }: { onInsert: (rows: number, cols: number) => void }) {
  const [open, setOpen] = useState(false);
  const [hv, setHv] = useState({ r: 0, c: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={btn} type="button" data-tip="표 넣기 (최대 10×10)" className={`re-btn ${open ? 'on' : ''}`}
        onMouseDown={e => e.preventDefault()} onClick={() => { setHv({ r: 0, c: 0 }); setOpen(o => !o); }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="1.5" y="2.5" width="13" height="11" rx="1" /><path d="M1.5 6.5h13M1.5 10h13M6 2.5v11M10.5 2.5v11" />
        </svg>
      </button>
      {open && (
        <Pop anchor={btn.current} onClose={() => setOpen(false)}>
          <div className="re-tgrid" onMouseLeave={() => setHv({ r: 0, c: 0 })}>
            {Array.from({ length: MAX_TABLE * MAX_TABLE }, (_, i) => {
              const r = Math.floor(i / MAX_TABLE) + 1, c = (i % MAX_TABLE) + 1;
              return (
                <button key={i} type="button" className={`re-tg ${r <= hv.r && c <= hv.c ? 'on' : ''}`}
                  aria-label={`${r}행 ${c}열`}
                  onMouseEnter={() => setHv({ r, c })}
                  onClick={() => { onInsert(r, c); setOpen(false); }} />
              );
            })}
          </div>
          <div className="re-pop-cap">{hv.r ? `${hv.r}행 × ${hv.c}열` : '넣을 크기를 고르세요'}</div>
        </Pop>
      )}
    </>
  );
}

/** 글꼴 고르기 — 목록의 글꼴을 각자의 모양으로 미리 보여 준다. 누르는 동안 본문 선택이 풀리지 않게(mousedown 막음) 한다 */
function FontBtn({ fonts, curId, onPick }: {
  fonts: { id: string; name: string; fam?: string }[]; curId: string; onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const cur = fonts.find(f => f.id === curId);
  return (
    <>
      <button ref={btn} type="button" data-tip="글꼴 (선택한 글자에만 적용)" className={`re-btn re-fontbtn ${open ? 'on' : ''}`}
        onMouseDown={e => e.preventDefault()} onClick={() => setOpen(o => !o)}>
        <span className="re-fontbtn-t" style={cur?.fam ? { fontFamily: cur.fam } : undefined}>{cur ? cur.name : '기본 글꼴'}</span>
        <span className="re-fontbtn-c">▾</span>
      </button>
      {open && (
        <Pop anchor={btn.current} onClose={() => setOpen(false)}>
          <div className="re-fontlist">
            <button type="button" className={`re-fontitem ${curId === '' ? 'on' : ''}`}
              onClick={() => { onPick(''); setOpen(false); }}>기본 글꼴</button>
            {fonts.map(f => (
              <button key={f.id} type="button" className={`re-fontitem ${curId === f.id ? 'on' : ''}`}
                style={f.fam ? { fontFamily: f.fam } : undefined}
                onClick={() => { onPick(f.id); setOpen(false); }}>{f.name}</button>
            ))}
          </div>
        </Pop>
      )}
    </>
  );
}

/** 표 테두리 — 블록(칸 선택)을 잡고 범위·선 모양·굵기·색을 정해 적용한다 (칸마다 네 변이 따로 저장된다) */
export type Pen = { style: string; width: number; color: string };
const PEN_STYLES = [
  { id: 'solid', label: '기본 선' },
  { id: 'thick', label: '굵은 선' },
  { id: 'double', label: '겹선' },
  { id: 'dotted', label: '점선' },
  { id: 'transparent', label: '투명' },
];
const SCOPES: [string, string][] = [
  ['table', '표 전체'], ['all', '선택 칸 전체'], ['outer', '외곽'], ['inner', '안쪽'],
  ['top', '위'], ['bottom', '아래'], ['left', '왼쪽'], ['right', '오른쪽'],
];
const penSample = (id: string): React.CSSProperties =>
  id === 'dotted' ? { borderTop: '2px dotted #333' }
    : id === 'double' ? { borderTop: '4px double #333' }
      : id === 'thick' ? { borderTop: '4px solid #333' }
        : id === 'transparent' ? { borderTop: '2px solid transparent', background: 'repeating-linear-gradient(90deg,#ccc 0 3px,transparent 3px 6px)', height: 1 }
          : { borderTop: '1px solid #333' };

function BorderBtn({ pen, setPen, onApply }: {
  pen: Pen; setPen: (p: Pen) => void; onApply: (scope: string, clear: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('all');
  const btn = useRef<HTMLButtonElement>(null);
  const curStyle = pen.style === 'solid' && pen.width >= 3 ? 'thick' : pen.style;
  const pick = (id: string) => setPen(id === 'thick' ? { ...pen, style: 'solid', width: Math.max(3, pen.width) }
    : id === 'solid' ? { ...pen, style: 'solid', width: pen.width >= 3 ? 1 : pen.width } : { ...pen, style: id });
  return (
    <>
      <button ref={btn} type="button" data-tip="테두리 모양" className={`re-btn ${open ? 'on' : ''}`}
        onMouseDown={e => e.preventDefault()} onClick={() => setOpen(o => !o)}>테두리 ▾</button>
      {open && (
        <Pop anchor={btn.current} onClose={() => setOpen(false)} className="wide">
          <div className="re-bp-h">적용 범위 <small>(칸을 끌어 선택 · 없으면 커서가 든 칸 · 색은 옆 「테두리 배경색」)</small></div>
          <div className="re-bp-grid">
            {SCOPES.map(([id, label]) => (
              <button key={id} type="button" className={`re-bp-s ${scope === id ? 'on' : ''}`} onClick={() => setScope(id)}>{label}</button>
            ))}
          </div>
          <div className="re-bp-h">선 모양</div>
          <div className="re-fontlist" style={{ maxHeight: 'none', margin: 0 }}>
            {PEN_STYLES.map(s => (
              <button key={s.id} type="button" className={`re-fontitem re-lineitem ${curStyle === s.id ? 'on' : ''}`} onClick={() => pick(s.id)}>
                <span>{s.label}</span><i style={penSample(s.id)} />
              </button>
            ))}
          </div>
          <div className="re-bp-h">굵기</div>
          <div className="re-pop-row" style={{ border: 0, margin: 0, padding: 0, justifyContent: 'flex-start' }}>
            <button type="button" className="re-pop-btn" onClick={() => setPen({ ...pen, width: Math.max(0.5, pen.width - 0.5) })}>−</button>
            <span className="re-tt-v">{pen.width}pt</span>
            <button type="button" className="re-pop-btn" onClick={() => setPen({ ...pen, width: Math.min(8, pen.width + 0.5) })}>＋</button>
          </div>
          <div className="re-pop-row">
            <button type="button" className="re-pop-btn" onClick={() => onApply(scope, true)}>선택 범위 선 지우기</button>
            <button type="button" className="re-pop-btn re-pop-go" onClick={() => onApply(scope, false)}>적용</button>
          </div>
        </Pop>
      )}
    </>
  );
}

const AlignIcon = ({ kind }: { kind: 'left' | 'center' | 'right' | 'justify' }) => {
  const w = { left: [12, 8, 12, 8], center: [12, 8, 12, 8], right: [12, 8, 12, 8], justify: [12, 12, 12, 12] }[kind];
  const x = (len: number) => (kind === 'left' || kind === 'justify' ? 2 : kind === 'center' ? (16 - len) / 2 : 14 - len);
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {w.map((len, i) => <path key={i} d={`M${x(len)} ${3.5 + i * 3}h${len}`} />)}
    </svg>
  );
};

/** 로컬 모드용 — 파일을 그대로 본문에 심는다 (서버가 없어 올릴 곳이 없을 때) */
function toDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

function TBtn({ on, label, title, onClick }: { on?: boolean; label: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" data-tip={title} className={`re-btn ${on ? 'on' : ''}`}
      onMouseDown={e => e.preventDefault()} onClick={onClick}>
      {label}
    </button>
  );
}

export function RichEditor({ value, onChange, placeholder, doc, size }: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  doc?: boolean;   // 긴 글(문서) 모양 — 읽기 화면과 같은 글자·문단·목록 모양으로 편집
  size?: number;   // 문서 글자 크기(px)
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // 링크 (v2.1 사용자 요청) — 툴바 아래 작은 입력줄로 주소를 받는다 (기본 prompt 창은 쓰지 않는다)
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  // HTML 코드 모드 (v2.1 사용자 요청) — 코드를 그대로 저장한다. 편집기로 돌아가면 지원하지 않는 태그·스타일이 정리될 수 있다
  const [srcMode, setSrcMode] = useState(false);
  const { fonts, familyOf } = useFonts();
  const [pen, setPen] = useState<Pen>({ style: 'solid', width: 1, color: '#000000' });   // 표 테두리 펜
  const editor = useEditor({
    // StarterKit(v3)에 든 링크는 누르면 바로 열리지 않게 — 편집 중 클릭은 커서 이동 (링크 삽입 v2.1)
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
      Image,
      TextStyleKit,                                        // 글꼴 · 글자색 · 글자 배경색
      TextAlign.configure({ types: ['heading', 'paragraph'] }),   // 왼쪽·가운데·오른쪽·양쪽 정렬
      RTable, RRow, RCell, RHeader,                        // 표
    ],
    content: value || '<p></p>',
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,   // 커서가 표 안에 들어오면 표 도구 줄이 나타나도록
    editorProps: {
      attributes: { class: doc ? 're-content prose doc-body' : 're-content prose' },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // 외부 값이 완전히 바뀐 경우(탭 전환) 동기화
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return <div className="re-wrap" style={{ minHeight: 200 }} />;

  // 명령 이름이 많아서(글꼴·색·표) 한 곳에서 느슨하게 부른다 — 확장이 등록한 명령이라 타입이 따로 안 잡힌다
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const C = () => editor.chain().focus() as any;

  /* 글꼴 — 지금 커서 글자의 font-family가 어느 폰트인지 거꾸로 찾아 드롭다운에 보여 준다 */
  const curFam = String(editor.getAttributes('textStyle').fontFamily ?? '').replace(/["']/g, '').replace(/\s+/g, ' ').trim();
  const curFontId = fonts.find(f => {
    const fam = (familyOf(f.id) ?? '').replace(/["']/g, '').replace(/\s+/g, ' ').trim();
    return fam && fam === curFam;
  })?.id ?? '';
  const pickFont = (id: string) => {
    if (!id) { C().unsetFontFamily().run(); return; }
    const fam = familyOf(id);
    if (fam) C().setFontFamily(fam).run();
  };

  /* 표 도구 줄 — 커서가 표 안에 있을 때만 */
  const inTable = editor.isActive('table');
  const tbl = inTable ? findAround(editor.state, 'table') : null;
  const tRows = tbl ? tbl.node.childCount : 0;
  const tCols = tbl && tbl.node.firstChild
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (() => { let n = 0; tbl.node.firstChild.forEach((c: any) => { n += c.attrs.colspan ?? 1; }); return n; })()
    : 0;
  const cellAttr = (k: string) => String(editor.getAttributes('tableCell')[k] ?? editor.getAttributes('tableHeader')[k] ?? '');
  const setTable = (patch: Record<string, unknown>) => editor.commands.command(({ state, tr, dispatch }) => {
    const t = findAround(state, 'table');
    if (!t) return false;
    tr.setNodeMarkup(t.pos, undefined, { ...t.node.attrs, ...patch });
    dispatch?.(tr);
    return true;
  });
  /** 테두리 적용 — 범위(표 전체/선택 칸 전체/외곽/안쪽/위·아래·왼쪽·오른쪽)에 따라 칸마다 네 변을 쓴다.
   *  맞닿은 이웃 칸의 반대쪽 변도 같이 써서(겹치는 선은 한 장이니) 어느 한쪽 값에 밀리지 않게 한다 */
  const applyBorder = (scope: string, clear: boolean) => editor.commands.command(({ state, tr, dispatch }) => {
    const t = findAround(state, 'table');
    if (!t) return false;
    const map = TableMap.get(t.node);
    const start = t.pos + 1;
    let rect: { left: number; top: number; right: number; bottom: number };
    const sel = state.selection;
    if (scope === 'table') rect = { left: 0, top: 0, right: map.width, bottom: map.height };
    else if (sel instanceof CellSelection) rect = map.rectBetween(sel.$anchorCell.pos - start, sel.$headCell.pos - start);
    else {
      const c = findAround(state, 'tableCell') ?? findAround(state, 'tableHeader');
      if (!c) return false;
      rect = map.findCell(c.pos - start);
    }
    const w = pen.style === 'double' ? Math.max(3, pen.width) : pen.width;
    const line = pen.style === 'dotted' ? 'dotted' : pen.style === 'double' ? 'double' : 'solid';
    const spec: string | null = clear ? null : `${w}pt ${line} ${pen.style === 'transparent' ? 'transparent' : pen.color}`;
    const patches = new Map<number, Record<string, string | null>>();
    const put = (off: number, side: string) => patches.set(off, { ...(patches.get(off) ?? {}), [side]: spec });
    const mode = scope === 'table' ? 'all' : scope;
    const wantOuter = (s: string) => mode === 'all' || mode === 'outer' || mode === s;
    map.cellsInRect(rect).forEach((off: number) => {
      const cr = map.findCell(off);
      if (wantOuter('top') && cr.top === rect.top) put(off, 'borderTop');
      if (wantOuter('bottom') && cr.bottom === rect.bottom) put(off, 'borderBottom');
      if (wantOuter('left') && cr.left === rect.left) put(off, 'borderLeft');
      if (wantOuter('right') && cr.right === rect.right) put(off, 'borderRight');
      if (mode === 'all' || mode === 'inner') {
        if (cr.top > rect.top) put(off, 'borderTop');
        if (cr.bottom < rect.bottom) put(off, 'borderBottom');
        if (cr.left > rect.left) put(off, 'borderLeft');
        if (cr.right < rect.right) put(off, 'borderRight');
      }
    });
    // 범위 바깥에서 맞닿은 이웃 칸의 반대쪽 변
    if (wantOuter('top') && rect.top > 0)
      map.cellsInRect({ left: rect.left, right: rect.right, top: rect.top - 1, bottom: rect.top }).forEach((o: number) => put(o, 'borderBottom'));
    if (wantOuter('bottom') && rect.bottom < map.height)
      map.cellsInRect({ left: rect.left, right: rect.right, top: rect.bottom, bottom: rect.bottom + 1 }).forEach((o: number) => put(o, 'borderTop'));
    if (wantOuter('left') && rect.left > 0)
      map.cellsInRect({ left: rect.left - 1, right: rect.left, top: rect.top, bottom: rect.bottom }).forEach((o: number) => put(o, 'borderRight'));
    if (wantOuter('right') && rect.right < map.width)
      map.cellsInRect({ left: rect.right, right: rect.right + 1, top: rect.top, bottom: rect.bottom }).forEach((o: number) => put(o, 'borderLeft'));
    patches.forEach((p, off) => {
      const cell = t.node.nodeAt(off);
      if (cell) tr.setNodeMarkup(start + off, undefined, { ...cell.attrs, ...p });
    });
    dispatch?.(tr);
    return true;
  });
  /** 열 폭 균등 — 지금 표 폭을 열 수로 나눠 **모든 열에 같은 폭을 새로 적어 준다**
   *  (예전엔 폭 값을 지우기만 해서, 끌어 늘린 열이 남은 폭을 그대로 차지했다) */
  const equalCols = () => {
    const t0 = findAround(editor.state, 'table');
    if (!t0) return;
    const wrap = editor.view.nodeDOM(t0.pos) as HTMLElement | null;
    const el = (wrap?.querySelector?.('table') as HTMLElement | null) ?? wrap;
    const total = Math.round(el?.offsetWidth || 0);
    const cols = TableMap.get(t0.node).width;
    if (!total || !cols) return;
    const w = Math.max(40, Math.floor(total / cols));
    editor.commands.command(({ state, tr, dispatch }) => {
      const t = findAround(state, 'table');
      if (!t) return false;
      const seen = new Set<number>();
      TableMap.get(t.node).map.forEach((off: number) => {
        if (seen.has(off)) return;       // 합친 칸은 여러 번 나온다
        seen.add(off);
        const cell = t.node.nodeAt(off);
        if (!cell) return;
        const span = (cell.attrs.colspan as number | undefined) ?? 1;
        tr.setNodeMarkup(t.pos + 1 + off, undefined, { ...cell.attrs, colwidth: Array(span).fill(w) });
      });
      dispatch?.(tr);
      return true;
    });
  };
  /** 현재 행 높이 바꾸기 (null이면 자동) */
  const rowHeightNow = () => {
    const r = findAround(editor.state, 'tableRow');
    if (!r) return 0;
    const dom = editor.view.nodeDOM(r.pos) as HTMLElement | null;
    return Math.round(r.node.attrs.rowHeight ?? dom?.offsetHeight ?? 0);
  };
  const setRowHeight = (h: number | null) => editor.commands.command(({ state, tr, dispatch }) => {
    const r = findAround(state, 'tableRow');
    if (!r) return false;
    tr.setNodeMarkup(r.pos, undefined, { ...r.node.attrs, rowHeight: h });
    dispatch?.(tr);
    return true;
  });
  /** 모든 행을 평균 높이로 맞춘다 */
  const equalRows = () => {
    const t = findAround(editor.state, 'table');
    if (!t) return;
    const hs: number[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t.node.forEach((_: any, off: number) => {
      const dom = editor.view.nodeDOM(t.pos + 1 + off) as HTMLElement | null;
      hs.push(dom?.offsetHeight ?? 0);
    });
    const avg = Math.round(hs.reduce((a, b) => a + b, 0) / Math.max(1, hs.length));
    editor.commands.command(({ state, tr, dispatch }) => {
      const t2 = findAround(state, 'table');
      if (!t2) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      t2.node.forEach((row: any, off: number) => {
        tr.setNodeMarkup(t2.pos + 1 + off, undefined, { ...row.attrs, rowHeight: avg });
      });
      dispatch?.(tr);
      return true;
    });
  };

  /* 링크 (v2.1) — 선택한 글자에 주소를 건다. 비우고 적용하면 해제 */
  const openLink = () => {
    setLinkUrl((editor.getAttributes('link').href as string | undefined) ?? '');
    setLinkOpen(o => !o);
  };
  const applyLink = () => {
    const u = linkUrl.trim();
    if (!u) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else {
      const href = /^(https?:|mailto:|\/)/.test(u) ? u : `https://${u}`;
      // 글자를 고르지 않았으면 주소 글자를 넣어 링크로
      if (editor.state.selection.empty) editor.chain().focus().insertContent(`<a href="${href}" target="_blank">${href}</a>`).run();
      else editor.chain().focus().extendMarkRange('link').setLink({ href, target: '_blank' }).run();
    }
    setLinkOpen(false);
  };
  /* HTML 코드 모드 (v2.1) — 코드 칸의 값이 그대로 저장값. 편집기로 돌아갈 때 그 코드를 다시 읽어 들인다 */
  const toggleSrc = () => {
    if (srcMode) editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    setSrcMode(s => !s);
  };

  /* 이미지는 **올려서** 넣는다 (v2.0 사용자 요청 — 예전엔 URL을 직접 적게 했다).
     다른 이미지들과 같은 경로(putBlob)를 타므로 서버 모드면 저장소에 올라가고 공개 주소가 나온다.
     서버가 없는 로컬 모드에서는 그 주소가 이 브라우저 안에서만 뜻이 있는 파일 id라
     <img>가 읽지 못한다 — 그때만 본문에 그대로 심는다(개발·오프라인용). */
  const insertImage = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const ref = await putBlob(f);
      const src = /^https?:/.test(ref) ? ref : await toDataUrl(f);
      editor.chain().focus().setImage({ src }).run();
    } catch (e) {
      // 조용히 실패하면 「올렸는데 왜 안 들어가지」가 된다 — 사유를 그대로 보여 준다
      toast(`이미지를 올리지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
  };

  return (
    <div className="re-wrap" style={size ? ({ '--doc-fs': `${size}px` } as React.CSSProperties) : undefined}>
      <div className="re-toolbar">
        <TBtn title="굵게" label={<b>B</b>} on={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()} />
        <TBtn title="기울임" label={<i>I</i>} on={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()} />
        <TBtn title="밑줄" label={<u>U</u>} on={editor.isActive('underline')}
          onClick={() => C().toggleUnderline().run()} />
        <TBtn title="취소선" label={<s>S</s>} on={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()} />
        <span className="re-sep" />
        {/* 글꼴 — 환경설정에 등록해 둔 폰트를 그대로 (읽는 화면에서도 같은 폰트로 보인다) */}
        <FontBtn fonts={fonts.map(f => ({ id: f.id, name: f.name, fam: familyOf(f.id) }))} curId={curFontId} onPick={pickFont} />
        <ColorBtn title="글자색" label="A" current={String(editor.getAttributes('textStyle').color ?? '')}
          onPick={c => C().setColor(c).run()} onClear={() => C().unsetColor().run()} />
        <ColorBtn title="글자 배경색" label={<span style={{ background: '#ffe066', padding: '0 3px', borderRadius: 2 }}>A</span>}
          current={String(editor.getAttributes('textStyle').backgroundColor ?? '')}
          onPick={c => C().setBackgroundColor(c).run()} onClear={() => C().unsetBackgroundColor().run()} />
        <span className="re-sep" />
        <TBtn title="왼쪽 정렬" label={<AlignIcon kind="left" />} on={editor.isActive({ textAlign: 'left' })}
          onClick={() => C().setTextAlign('left').run()} />
        <TBtn title="가운데 정렬" label={<AlignIcon kind="center" />} on={editor.isActive({ textAlign: 'center' })}
          onClick={() => C().setTextAlign('center').run()} />
        <TBtn title="오른쪽 정렬" label={<AlignIcon kind="right" />} on={editor.isActive({ textAlign: 'right' })}
          onClick={() => C().setTextAlign('right').run()} />
        <TBtn title="양쪽 정렬" label={<AlignIcon kind="justify" />} on={editor.isActive({ textAlign: 'justify' })}
          onClick={() => C().setTextAlign('justify').run()} />
        {/* 다음 줄부터 글 구분(제목·본문)으로 시작 — 데스크톱은 줄바꿈, 모바일(한 줄 스크롤)은 구분선 */}
        <span className="re-br" />
        <span className="re-sep re-m-only" />
        {/* 제목1·2·3 / 본문 — 읽기 화면의 목차가 이 제목들로 만들어진다 */}
        <TBtn title="제목 1" label="H1" on={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <TBtn title="제목 2" label="H2" on={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <TBtn title="제목 3" label="H3" on={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <TBtn title="본문" label="¶" on={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()} />
        <span className="re-sep" />
        <TBtn title="글머리 목록" label="•≡" on={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <TBtn title="번호 목록" label="1≡" on={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <TBtn title="인용" label="❝" on={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <TBtn title="구분선" label="—" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <TableBtn onInsert={(r, c) => C().insertTable({ rows: r, cols: c, withHeaderRow: false }).run()} />
        <span className="re-sep" />
        {/* 링크 · HTML 코드 (v2.1 사용자 요청 — 「본문 글자에 링크를 걸거나 html 코드를 적용」) */}
        <TBtn title="링크 (선택한 글자에)" label="🔗" on={editor.isActive('link') || linkOpen} onClick={openLink} />
        <TBtn title={srcMode ? '편집기로 돌아가기' : 'HTML 코드로 편집'} label={<span style={{ fontSize: 11, fontFamily: 'monospace' }}>&lt;/&gt;</span>} on={srcMode} onClick={toggleSrc} />
        <span className="re-sep" />
        <TBtn title={busy ? '올리는 중…' : '이미지 올리기'} label={busy ? '⏳' : '🖼'}
          onClick={() => { if (!busy) fileRef.current?.click(); }} />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void insertImage(f); }} />
        {/* 실행 취소·다시 실행은 모바일에서 숨김 — 툴바가 두 줄로 넘어가 본문 영역을 침범 (v1.9 사용자 확정)
            (단축키 Ctrl+Z / Ctrl+Shift+Z는 그대로 동작) */}
        <span className="re-sep re-hide-m" />
        <span className="re-hide-m" style={{ display: 'contents' }}>
          <TBtn title="실행 취소" label="↶" onClick={() => editor.chain().focus().undo().run()} />
          <TBtn title="다시 실행" label="↷" onClick={() => editor.chain().focus().redo().run()} />
        </span>
      </div>
      {inTable && !srcMode && (
        <div className="re-toolbar re-tt">
          <span className="re-tt-l">표</span>
          <TBtn title="위에 행 추가" label="↑행+" onClick={() => { if (tRows < MAX_TABLE) C().addRowBefore().run(); }} />
          <TBtn title="아래에 행 추가" label="↓행+" onClick={() => { if (tRows < MAX_TABLE) C().addRowAfter().run(); }} />
          <TBtn title="왼쪽에 열 추가" label="←열+" onClick={() => { if (tCols < MAX_TABLE) C().addColumnBefore().run(); }} />
          <TBtn title="오른쪽에 열 추가" label="→열+" onClick={() => { if (tCols < MAX_TABLE) C().addColumnAfter().run(); }} />
          <TBtn title="행 삭제" label="행−" onClick={() => C().deleteRow().run()} />
          <TBtn title="열 삭제" label="열−" onClick={() => C().deleteColumn().run()} />
          <span className="re-sep" />
          <TBtn title="셀 병합" label="병합" onClick={() => C().mergeCells().run()} />
          <TBtn title="셀 분할" label="분할" onClick={() => C().splitCell().run()} />
          <span className="re-sep" />
          <TBtn title="행 높이 줄이기" label="행 ▾" onClick={() => setRowHeight(Math.max(20, rowHeightNow() - 10))} />
          <TBtn title="행 높이 늘리기" label="행 ▴" onClick={() => setRowHeight(rowHeightNow() + 10)} />
          <span className="re-sep" />
          <button type="button" className="re-btn" onMouseDown={e => e.preventDefault()} onClick={equalCols}>열 균등</button>
          <button type="button" className="re-btn" onMouseDown={e => e.preventDefault()} onClick={equalRows}>행 균등</button>
          {/* 다음 줄 — 색·테두리·맞춤·표 놓기 (모바일은 한 줄 스크롤이라 구분선만) */}
          <span className="re-br" />
          <span className="re-sep re-m-only" />
          <ColorBtn title="칸 배경색" label="▧" current={cellAttr('backgroundColor')}
            onPick={c => C().setCellAttribute('backgroundColor', c).run()}
            onClear={() => C().setCellAttribute('backgroundColor', null).run()} />
          <ColorBtn title="테두리 배경색" label={<span className="re-lineicon" />} current={pen.color}
            onPick={c => setPen({ ...pen, color: c })} onClear={() => setPen({ ...pen, color: '#000000' })} />
          <BorderBtn pen={pen} setPen={setPen} onApply={applyBorder} />
          <span className="re-sep" />
          <TBtn title="위쪽 맞춤" label="⤒" on={cellAttr('vAlign') === 'top'} onClick={() => C().setCellAttribute('vAlign', 'top').run()} />
          <TBtn title="가운데 맞춤" label="↕" on={cellAttr('vAlign') === 'middle'} onClick={() => C().setCellAttribute('vAlign', 'middle').run()} />
          <TBtn title="아래쪽 맞춤" label="⤓" on={cellAttr('vAlign') === 'bottom'} onClick={() => C().setCellAttribute('vAlign', 'bottom').run()} />
          <TBtn title="높이 자동" label="행 자동" onClick={() => setRowHeight(null)} />
          <span className="re-sep" />
          <TBtn title="좌측 정렬" label="표◧" on={(tbl?.node.attrs.tableAlign ?? 'left') === 'left'} onClick={() => setTable({ tableAlign: 'left' })} />
          <TBtn title="가운데 정렬" label="표◫" on={tbl?.node.attrs.tableAlign === 'center'} onClick={() => setTable({ tableAlign: 'center' })} />
          <TBtn title="우측 정렬" label="표◨" on={tbl?.node.attrs.tableAlign === 'right'} onClick={() => setTable({ tableAlign: 'right' })} />
          <span className="re-sep" />
          <TBtn title="표 삭제" label="표 삭제" onClick={() => C().deleteTable().run()} />
        </div>
      )}
      {linkOpen && !srcMode && (
        <div className="re-linkrow">
          <input className="k-input" placeholder="https://… (비우고 적용하면 링크 해제)" value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setLinkOpen(false); }} />
          <button type="button" className="btn btn-dark" style={{ height: 30, padding: '0 12px', fontSize: 11 }} onClick={applyLink}>적용</button>
          <button type="button" className="btn btn-ghost" style={{ height: 30, padding: '0 10px', fontSize: 11 }} onClick={() => setLinkOpen(false)}>닫기</button>
        </div>
      )}
      {srcMode ? (
        /* HTML 코드 — 적은 그대로 저장된다 (표시할 때 스크립트 등은 걸러진다) */
        <div className="re-body">
          <textarea className="re-src" value={value} spellCheck={false}
            onChange={e => onChange(e.target.value)} placeholder="<p>HTML 코드를 여기에</p>" />
          <div className="hint" style={{ padding: '4px 10px 8px' }}>HTML 코드는 적은 그대로 저장됩니다 — 편집기로 돌아가면 지원하지 않는 태그·스타일은 정리될 수 있습니다 (script·iframe 등은 표시할 때 걸러집니다)</div>
        </div>
      ) : (
        /* 플레이스홀더는 본문 영역 기준으로 — 툴바가 두 줄이 돼도 안 밀림 (v1.9 사용자 발견) */
        <div className="re-body">
          <EditorContent editor={editor} />
          {placeholder && editor.isEmpty && <div className="re-ph">{placeholder}</div>}
        </div>
      )}
    </div>
  );
}
