'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 이벤트 공유 버튼 — 데스크톱은 클립보드 복사(하단 토스트 안내),
 * 터치 기기는 시스템 공유 시트. (macOS 크롬도 navigator.share가 있어서
 * share 존재 여부가 아니라 포인터 종류로 분기해야 데스크톱에서 복사가 된다)
 * 토스트는 portal로 body에 직접 그린다 — 카드의 hover transform이
 * fixed의 기준이 되어 위치가 틀어지는 것을 방지.
 */
export function ShareButton({ path, className }: { path: string; className: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard API가 막힌 환경 폴백
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${path}`;
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch && navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        return; // 사용자가 공유 시트를 닫음
      }
    }
    await copy(url);
  };

  return (
    <span className="group relative">
      <button onClick={share} aria-label="Copy event link" className={className}>
        🔗
      </button>
      <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-1 hidden whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-white dark:text-stone-900">
        Copy link
      </span>
      {copied &&
        createPortal(
          <span
            role="status"
            className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-stone-900/95 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-white/95 dark:text-stone-900"
          >
            🔗 Link copied to clipboard
          </span>,
          document.body,
        )}
    </span>
  );
}
