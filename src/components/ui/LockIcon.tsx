// 작은 자물쇠 — 비밀글·접힘 글의 제목 옆 표시 (이모지 대신 선 아이콘, 글씨색을 따라간다)
import React from 'react';

export function LockIcon({ title }: { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-label={title ?? '잠금'} role="img"
      style={{ width: '.82em', height: '.82em', marginLeft: 5, verticalAlign: '-.06em', stroke: 'currentColor', fill: 'none',
        strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: .55, flexShrink: 0 }}>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  );
}
