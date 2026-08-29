'use client';

import { useEffect, useState } from 'react';

/** 페이지를 이만큼 열어둔 채 다시 보면 리로드를 권장 */
const STALE_MS = 30 * 60 * 1000;

export function FreshnessBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const loadedAt = Date.now();
    const check = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt > STALE_MS) {
        setStale(true);
      }
    };
    document.addEventListener('visibilitychange', check);
    const interval = setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {stale && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 border-t border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <span>This page may be outdated.</span>
          <button
            onClick={() => location.reload()}
            className="rounded-md bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700"
          >
            Reload
          </button>
          <button
            onClick={() => setStale(false)}
            aria-label="Dismiss"
            className="text-amber-500 hover:text-amber-700"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
