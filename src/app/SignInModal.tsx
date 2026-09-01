'use client';

import { signInWithGoogle } from '@/lib/supabase/client';
import { useLockBodyScroll } from '@/lib/use-lock-scroll';

/** 로그인 유도 모달 — 게이팅된 기능 클릭 또는 헤더 Sign in에서 열림 */
export function SignInModal({
  open,
  onClose,
  next,
  message,
}: {
  open: boolean;
  onClose: () => void;
  next?: string;
  message?: string;
}) {
  useLockBodyScroll(open);
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white p-6 text-center text-stone-800 shadow-xl dark:bg-stone-900 dark:text-stone-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/happy-wolf.png" alt="" className="mx-auto h-24 w-24" />
        <h2 className="font-display mt-1 text-lg font-bold">Join the hunt</h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {message ?? 'Sign in to save events and get the most out of the hunt.'}
        </p>
        <button
          onClick={() => signInWithGoogle(next)}
          className="mt-4 w-full rounded-lg bg-red-800 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 active:scale-[0.98]"
        >
          Continue with NC State Google
        </button>
        <p className="mt-2 text-xs text-stone-400">
          Only @ncsu.edu accounts are allowed.
        </p>
        <button
          onClick={onClose}
          className="mt-3 text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
