// 문서 에디터 확장 — ① 글자처럼 줄에 놓이고 끌어서·숫자로 크기를 바꾸는 이미지 ② 줄 간격·단락 앞뒤 공백
import Image from '@tiptap/extension-image';
import { Extension } from '@tiptap/react';

const px = (v: unknown) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/* ───────── 이미지 — 글자처럼(inline) · 크기는 style의 width/height로 저장 ───────── */
export const ResizableImage = Image.extend({
  inline: true,
  group: 'inline',
  draggable: true,
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => px(el.style.width) ?? px(el.getAttribute('width')),
        renderHTML: () => ({}),
      },
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => px(el.style.height) ?? px(el.getAttribute('height')),
        renderHTML: () => ({}),
      },
    };
  },
  // 저장 모양: <img src style="width:120px;height:80px"> — 읽기 화면은 정렬(문단 text-align)이 그대로 적용된다
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderHTML({ node, HTMLAttributes }: any) {
    const st = [node.attrs.width ? `width:${node.attrs.width}px` : '', node.attrs.height ? `height:${node.attrs.height}px` : '']
      .filter(Boolean).join(';');
    return ['img', { ...HTMLAttributes, ...(st ? { style: st } : {}) }];
  },
  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ({ node, editor, getPos }: any) => {
      let cur = node;
      const wrap = document.createElement('span');
      wrap.className = 're-img';
      const img = document.createElement('img');
      img.draggable = false;
      wrap.appendChild(img);
      const paint = () => {
        img.src = cur.attrs.src;
        img.alt = cur.attrs.alt ?? '';
        img.style.width = cur.attrs.width ? `${cur.attrs.width}px` : '';
        img.style.height = cur.attrs.height ? `${cur.attrs.height}px` : '';
      };
      paint();

      const commit = (w: number, h: number | null) => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (pos == null) return;
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...cur.attrs, width: w, height: h }));
      };
      // 모서리(se)는 비율 유지, 오른쪽(e)은 가로만, 아래쪽(s)은 세로만
      (['e', 's', 'se'] as const).forEach(k => {
        const h = document.createElement('span');
        h.className = `re-img-h re-img-h-${k}`;
        h.contentEditable = 'false';
        h.addEventListener('mousedown', ev => {
          ev.preventDefault(); ev.stopPropagation();
          const r = img.getBoundingClientRect();
          const w0 = r.width, h0 = r.height, x0 = ev.clientX, y0 = ev.clientY;
          let w = Math.round(w0), hh = Math.round(h0);
          const move = (e: MouseEvent) => {
            if (k === 'e') w = Math.max(16, Math.round(w0 + e.clientX - x0));
            if (k === 's') hh = Math.max(16, Math.round(h0 + e.clientY - y0));
            if (k === 'se') { w = Math.max(16, Math.round(w0 + e.clientX - x0)); hh = Math.max(16, Math.round(w * h0 / w0)); }
            img.style.width = `${w}px`; img.style.height = `${hh}px`;
          };
          const up = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            commit(w, hh);
          };
          document.addEventListener('mousemove', move);
          document.addEventListener('mouseup', up);
        });
        wrap.appendChild(h);
      });
      return {
        dom: wrap,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update: (n: any) => { if (n.type !== cur.type) return false; cur = n; paint(); return true; },
        selectNode: () => wrap.classList.add('sel'),
        deselectNode: () => wrap.classList.remove('sel'),
        stopEvent: (e: Event) => (e.target as HTMLElement)?.classList?.contains('re-img-h') ?? false,
        ignoreMutation: () => true,
      };
    };
  },
});

/* ───────── 줄 간격 · 단락 앞/뒤 공백 — 문단·제목마다 저장 ───────── */
export const BlockSpacing = Extension.create({
  name: 'blockSpacing',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
          renderHTML: (a: Record<string, unknown>) => (a.lineHeight ? { style: `line-height:${a.lineHeight}` } : {}),
        },
        // 'add' = 앞에 공백 추가
        spaceBefore: {
          default: null,
          parseHTML: (el: HTMLElement) => (el.dataset.sb ? el.dataset.sb : null),
          renderHTML: (a: Record<string, unknown>) => (a.spaceBefore ? { 'data-sb': String(a.spaceBefore), style: 'margin-top:1em' } : {}),
        },
        // 'none' = 뒤 공백 없앰 (기본은 뒤에 공백이 있는 상태)
        spaceAfter: {
          default: null,
          parseHTML: (el: HTMLElement) => (el.dataset.sa ? el.dataset.sa : null),
          renderHTML: (a: Record<string, unknown>) => (a.spaceAfter ? { 'data-sa': String(a.spaceAfter), style: 'margin-bottom:0' } : {}),
        },
      },
    }];
  },
});
