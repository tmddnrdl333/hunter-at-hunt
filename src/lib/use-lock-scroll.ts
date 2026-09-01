import { useEffect } from 'react';

// 모달이 중첩되어도 안전하도록 전역 카운터 — 마지막 잠금이 풀릴 때만 복원
let lockCount = 0;

/** 모달이 열려 있는 동안 배경 페이지 스크롤을 잠근다 */
export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    lockCount++;
    if (lockCount === 1) document.body.style.overflow = 'hidden';
    return () => {
      lockCount--;
      if (lockCount === 0) document.body.style.overflow = '';
    };
  }, [locked]);
}
