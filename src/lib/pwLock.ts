'use client';
// 비밀번호 비밀글 (B 디자인에서 가져온 기능) — 본문을 **비밀번호로 암호화해서** 저장한다.
//
// 이 홈은 서버 코드 없이 브라우저가 DB를 직접 읽는 구조라, 「비밀번호가 맞으면 보여 준다」를 화면에서만 하면
// 주소를 아는 사람은 DB에서 본문을 그대로 꺼낼 수 있다. 그래서 본문 자체를 비밀번호로 잠가 둔다:
// DB에는 알아볼 수 없는 암호문만 있고, 비밀번호를 아는 사람의 브라우저에서만 풀린다.
// (PBKDF2-SHA256 15만 회로 열쇠를 만들고 AES-GCM으로 잠금 — 브라우저 기본 기능 WebCrypto)
// ※ 비밀번호를 잊으면 관리자도 열 수 없다 — 어디에도 비밀번호를 저장하지 않기 때문.

export interface PwLock {
  v: 1;
  salt: string;   // base64
  iv: string;     // base64
  data: string;   // base64 — 암호화한 본문
}

const ITER = 150000;
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u: Uint8Array) => { let s = ''; u.forEach(c => { s += String.fromCharCode(c); }); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function keyOf(pw: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function lockText(text: string, pw: string): Promise<PwLock> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyOf(pw, salt);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(text)));
  return { v: 1, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

/** 비밀번호가 틀리면 null */
export async function unlockText(lock: PwLock, pw: string): Promise<string | null> {
  try {
    const key = await keyOf(pw, unb64(lock.salt));
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(lock.iv) as BufferSource }, key, unb64(lock.data) as BufferSource);
    return dec.decode(out);
  } catch {
    return null;
  }
}

/** 한 번 푼 글은 창을 닫을 때까지 다시 묻지 않는다 (같은 창 안에서 이전/다음 글을 오갈 때) */
const opened = new Map<string, string>();
export const rememberUnlocked = (id: string, text: string) => { opened.set(id, text); };
export const unlockedOf = (id: string) => opened.get(id);
