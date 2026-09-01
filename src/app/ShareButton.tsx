'use client';

import { useState } from 'react';

/** 이벤트 공유 버튼 — 모바일은 시스템 공유 시트, 데스크톱은 링크 복사 */
export function ShareButton({ path, className }: { path: string; className: string }) {
  const [copied, setCopied] = useState(false);

  const share = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        /* 사용자가 공유 시트를 닫음 → 복사로 폴백하지 않고 종료 */
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 미지원 환경은 조용히 무시 */
    }
  };

  return (
    <button
      onClick={share}
      aria-label="Share event"
      title="Share"
      className={className}
    >
      {copied ? '✓' : '🔗'}
    </button>
  );
}
