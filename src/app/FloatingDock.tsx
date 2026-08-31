'use client';

import { useState } from 'react';
import { signOut } from '@/lib/supabase/client';
import { FeedbackButton } from './FeedbackButton';
import { GuideButton } from './GuideButton';
import { SignInModal } from './SignInModal';

const SEGMENT_CLASS =
  'px-3 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800';

/** 좌하단 플로팅 메뉴: Sign in/계정 · Guide · Feedback (구분선으로 분리) */
export function FloatingDock({
  authEnabled,
  userEmail,
}: {
  authEnabled: boolean;
  userEmail: string | null;
}) {
  const [signInOpen, setSignInOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-40">
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
      <div className="flex items-stretch divide-x divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white/95 shadow-lg backdrop-blur dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-900/95">
        {authEnabled &&
          (userEmail ? (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Account"
              className={SEGMENT_CLASS}
            >
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-800 text-xs font-bold text-white">
                {userEmail[0].toUpperCase()}
              </span>
              Account
            </button>
          ) : (
            <button onClick={() => setSignInOpen(true)} className={SEGMENT_CLASS}>
              Sign in
            </button>
          ))}
        <GuideButton className={SEGMENT_CLASS} />
        {authEnabled && (
          <FeedbackButton userSignedIn={!!userEmail} className={SEGMENT_CLASS} />
        )}
      </div>
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
