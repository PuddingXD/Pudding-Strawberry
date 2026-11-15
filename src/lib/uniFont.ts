// 유니코드 장식 글꼴 (qaz.wtf 같은 변환기) — 글자 자체를 다른 유니코드 문자로 바꾼다.
// 폰트 파일이 아니라 문자라서 어디에 복사해 붙여도 그대로 보인다. 영문 대소문자(와 가능한 숫자)만 바뀌고 한글 등은 그대로.

export interface UniStyle {
  id: string;
  name: string;
  upper?: number;                       // 'A'에 해당하는 코드포인트 (26자 연속)
  lower?: number;                       // 'a'
  digit?: number;                       // '0' (10자 연속) — 없으면 숫자는 그대로
  holes?: Record<string, string>;       // 연속 배열에서 빠진 글자 (예: 이중선 C → ℂ)
  regional?: boolean;                   // 국가 표시 문자 (A–Z 대소문자 모두)
}

const cp = (n: number) => String.fromCodePoint(n);

export const UNI_STYLES: UniStyle[] = [
  { id: 'bold', name: 'Math bold', upper: 0x1D400, lower: 0x1D41A, digit: 0x1D7CE },
  { id: 'fraktur-bold', name: 'Math bold Fraktur', upper: 0x1D56C, lower: 0x1D586 },
  { id: 'bold-italic', name: 'Math bold italic', upper: 0x1D468, lower: 0x1D482 },
  { id: 'script-bold', name: 'Math bold script', upper: 0x1D4D0, lower: 0x1D4EA },
  { id: 'double', name: 'Math double-struck', upper: 0x1D538, lower: 0x1D552, digit: 0x1D7D8,
    holes: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' } },
  { id: 'mono', name: 'Math monospace', upper: 0x1D670, lower: 0x1D68A, digit: 0x1D7F6 },
  { id: 'sans', name: 'Math sans', upper: 0x1D5A0, lower: 0x1D5BA, digit: 0x1D7E2 },
  { id: 'sans-bold', name: 'Math sans bold', upper: 0x1D5D4, lower: 0x1D5EE, digit: 0x1D7EC },
  { id: 'sans-bold-italic', name: 'Math sans bold italic', upper: 0x1D63C, lower: 0x1D656, digit: 0x1D7EC },
  { id: 'sans-italic', name: 'Math sans italic', upper: 0x1D608, lower: 0x1D622 },
  { id: 'regional', name: 'Regional Indicator', regional: true },
];

/** 국가 표시 문자끼리 붙으면 깃발로 합쳐지므로, 사이에 합침 방지 문자(ZWNJ)를 끼운다 — 되돌릴 때 같이 걷어 낸다 */
const ZWNJ = '‌';

function mapChar(s: UniStyle, ch: string): string {
  const c = ch.charCodeAt(0);
  if (s.regional) {
    if (c >= 65 && c <= 90) return cp(0x1F1E6 + c - 65) + ZWNJ;
    if (c >= 97 && c <= 122) return cp(0x1F1E6 + c - 97) + ZWNJ;
    return ch;
  }
  if (c >= 65 && c <= 90) return s.holes?.[ch] ?? cp(s.upper! + c - 65);
  if (c >= 97 && c <= 122) return cp(s.lower! + c - 97);
  if (c >= 48 && c <= 57 && s.digit) return cp(s.digit + c - 48);
  return ch;
}

/** 문자열의 영문·숫자를 그 서체로 — 이미 다른 장식 서체인 글자는 먼저 원래대로 돌린 뒤 바꾼다 */
export function toUni(text: string, styleId: string): string {
  const s = UNI_STYLES.find(x => x.id === styleId);
  if (!s) return text;
  return Array.from(fromUni(text)).map(ch => mapChar(s, ch)).join('');
}

let rev: Map<string, string> | null = null;
function reverseMap(): Map<string, string> {
  if (rev) return rev;
  const m = new Map<string, string>();
  for (const s of UNI_STYLES) {
    for (let i = 0; i < 26; i++) {
      const U = String.fromCharCode(65 + i), L = String.fromCharCode(97 + i);
      if (s.regional) { m.set(cp(0x1F1E6 + i), U); continue; }
      m.set(s.holes?.[U] ?? cp(s.upper! + i), U);
      m.set(cp(s.lower! + i), L);
    }
    if (s.digit) for (let i = 0; i < 10; i++) m.set(cp(s.digit + i), String(i));
  }
  rev = m;
  return m;
}

/** 장식 서체 글자를 보통 영문·숫자로 되돌린다 (국가 표시 문자는 대문자) */
export function fromUni(text: string): string {
  const m = reverseMap();
  return Array.from(text.replace(/‌/g, '')).map(ch => m.get(ch) ?? ch).join('');
}
