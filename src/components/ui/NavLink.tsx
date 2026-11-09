'use client';
// 진짜 링크(<a href>) — 브라우저가 링크로 알아보게 해서 Ctrl+클릭(새 탭)·Shift+클릭(새 창)·휠 클릭·
// 우클릭 메뉴(새 탭/새 창/시크릿 창에서 열기)가 그대로 동작하게 한다 (사용자 요청).
// 그냥 클릭은 예전처럼 화면 안에서 부드럽게 이동 — onGo를 주면 그 함수로(편집모드 종료 확인 같은 기존 동작 유지),
// 안 주면 router.push. 특수 클릭(Ctrl/Shift/Alt/휠/우클릭)은 브라우저에 맡긴다.
import React from 'react';
import { useRouter } from 'next/navigation';

/** 그냥 왼쪽 클릭인가 (특수 키·휠·우클릭이 아님) — 이때만 화면 안 이동으로 가로챈다 */
export const isPlainClick = (e: React.MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** 링크 안쪽의 단추(와 data-nonav 를 단 요소)를 눌렀을 때는 링크 이동이 일어나지 않게 — 안쪽 요소가 직접 처리한다.
 *  (브라우저 기본 동작은 안쪽 요소가 stopPropagation을 해도 링크를 따라가 버리므로 캡처 단계에서 막는다.
 *   단추가 아닌 요소는 data-nonav 를 달면 같은 취급) */
const INNER = 'button,[data-nonav]';

export function NavLink({ href, onGo, children, onClick, onClickCapture, ...rest }: {
  href: string;
  /** 그냥 클릭 때 실행 (없으면 router.push(href)) — 이동 전 확인·새로고침 같은 기존 처리용 */
  onGo?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}) {
  const router = useRouter();
  return (
    <a {...rest} href={href} data-nl=""
      onClickCapture={e => {
        onClickCapture?.(e);
        const t = e.target as HTMLElement;
        const inner = t !== e.currentTarget ? t.closest(INNER) : null;
        if (inner && inner !== e.currentTarget && e.currentTarget.contains(inner)) e.preventDefault();
      }}
      onClick={e => {
        onClick?.(e);
        if (e.defaultPrevented || !isPlainClick(e) || rest.target === '_blank') return;
        e.preventDefault();
        if (onGo) onGo(); else router.push(href);
      }}>
      {children}
    </a>
  );
}

/** 카드·목록 행 같은 덩어리 전체를 링크로 — 링크가 아닐 때(권한 없음·편집모드·접힘 등)는 href를 비우면 예전처럼 일반 요소.
 *  tag: 링크가 아닐 때 쓸 태그(기본 div). 링크일 때는 모양이 그대로이도록 display는 클래스가 정한다(없으면 block) */
export function NavBox({ href, onGo, tag, className, children, ...rest }: {
  href?: string;
  onGo?: () => void;
  tag?: 'div' | 'article' | 'li';
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}) {
  if (href) return <NavLink href={href} onGo={onGo} className={`nlb ${className ?? ''}`.trim()} {...rest}>{children}</NavLink>;
  const Tag = tag ?? 'div';
  return <Tag className={className} {...rest}>{children}</Tag>;
}
