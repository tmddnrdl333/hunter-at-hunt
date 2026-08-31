'use client';

import { useEffect, useState } from 'react';

/** 로그인/로그아웃 직후 잠깐 떴다 사라지는 안내 토스트. URL의 ?auth는 즉시 제거. */
export function AuthToast({
  kind,
  email,
}: {
  kind: 'signedin' | 'signedout';
  email?: string | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('auth')) {
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
    // 한 프레임 뒤에 표시해서 슬라이드-인 트랜지션 발동
    const showTimer = setTimeout(() => setVisible(true), 30);
    const hideTimer = setTimeout(() => setVisible(false), 3000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const message =
    kind === 'signedin'
      ? `🐺 Signed in${email ? ` as ${email}` : ''} — happy hunting!`
      : '👋 Signed out. See you at the next hunt!';

  return (
    // bottom-20: 좌하단 플로팅 독(약 64px) 위에 떠서 좁은 화면에서도 겹치지 않음
    <div
      role="status"
      className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-stone-900/95 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all duration-300 dark:bg-white/95 dark:text-stone-900 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      {message}
    </div>
  );
}
