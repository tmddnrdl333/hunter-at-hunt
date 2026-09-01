'use client';

import { useEffect, useState } from 'react';
import { signInWithGoogle } from '@/lib/supabase/client';
import { useEscapeKey } from '@/lib/use-escape';
import { useLockBodyScroll } from '@/lib/use-lock-scroll';

/** 로그인 실패 시 뜨는 팝업. URL의 ?auth_error는 표시 후 지워서 새로고침 시 재등장 방지. */
export function AuthErrorModal({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  useLockBodyScroll(open);
  useEscapeKey(open, () => setOpen(false));

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('auth_error')) {
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);

  if (!open) return null;
  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white p-6 text-center text-stone-800 shadow-xl dark:bg-stone-900 dark:text-stone-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/not-found.png" alt="" className="mx-auto h-28 w-28" />
        <h2 className="font-display mt-1 text-lg font-bold">Sign-in failed</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {message}
        </p>
        <button
          onClick={() => signInWithGoogle('/')}
          className="mt-4 w-full rounded-lg bg-red-800 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 active:scale-[0.98]"
        >
          Try again with NC State Google
        </button>
        <button
          onClick={() => setOpen(false)}
          className="mt-3 text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}
