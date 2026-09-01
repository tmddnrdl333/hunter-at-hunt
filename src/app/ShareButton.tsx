'use client';

import { useState } from 'react';

/**
 * 이벤트 공유 버튼 — 데스크톱은 클립보드 복사(✓ Copied 표시),
 * 터치 기기는 시스템 공유 시트. (macOS 크롬도 navigator.share가 있어서
 * share 존재 여부가 아니라 포인터 종류로 분기해야 데스크톱에서 복사가 된다)
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
    setTimeout(() => setCopied(false), 1500);
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
    <button onClick={share} aria-label="Copy event link" title="Copy link" className={className}>
      {copied ? '✓ Copied' : '🔗 Share'}
    </button>
  );
}
