'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from '@/lib/supabase/client';
import { useEscapeKey } from '@/lib/use-escape';
import { FeedbackButton } from './FeedbackButton';
import { GuideButton } from './GuideButton';
import { SignInModal } from './SignInModal';

/**
 * 독 버튼 공통 스타일 — 바는 하나로 이어져 보이되, 각 버튼은 hover/press 시
 * 개별적으로 눌리는 느낌(자체 라운드 + 배경 하이라이트 + scale).
 */
const SEGMENT_CLASS =
  'rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-white/15 active:scale-95 whitespace-nowrap';

/** 버튼 사이 구분선 — 위아래가 바 가장자리에 닿지 않는 짧은 선 */
function Divider() {
  return <div aria-hidden className="h-5 w-px shrink-0 bg-white/30" />;
}

/** 좌하단 플로팅 독: Sign in/계정 · Guide · Feedback */
export function FloatingDock({
  authEnabled,
  userEmail,
}: {
  authEnabled: boolean;
  userEmail: string | null;
}) {
  const [signInOpen, setSignInOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEscapeKey(menuOpen, () => setMenuOpen(false));

  // Account 메뉴 밖을 클릭하면 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [menuOpen]);

  return (
    // 주의: 이 트리에 backdrop-blur/transform을 주면 안 됨 —
    // 자손 모달(position: fixed)의 기준이 뷰포트가 아니게 되어 팝업이 독 안에 갇힌다
    <div ref={wrapRef} className="fixed bottom-4 left-4 z-40">
      {menuOpen && userEmail && (
        <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-stone-200 bg-white p-2 shadow-lg dark:border-stone-700 dark:bg-stone-900">
          <p className="truncate px-2 py-1 text-xs text-stone-400">{userEmail}</p>
          <button
            onClick={() => signOut()}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            Sign out
          </button>
        </div>
      )}
      <div className="flex items-center gap-1 rounded-2xl bg-red-800 p-1.5 shadow-lg shadow-red-950/40 ring-1 ring-red-950/40">
        {authEnabled && (
          <>
            {userEmail ? (
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Account"
                className={SEGMENT_CLASS}
              >
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-red-800">
                  {userEmail[0].toUpperCase()}
                </span>
                Account
              </button>
            ) : (
              <button onClick={() => setSignInOpen(true)} className={SEGMENT_CLASS}>
                🔑 Sign in
              </button>
            )}
            <Divider />
          </>
        )}
        <GuideButton className={SEGMENT_CLASS} />
        {authEnabled && (
          <>
            <Divider />
            <FeedbackButton userSignedIn={!!userEmail} className={SEGMENT_CLASS} />
          </>
        )}
      </div>
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
