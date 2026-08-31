'use client';

import { useState } from 'react';
import { signOut } from '@/lib/supabase/client';
import { SignInModal } from './SignInModal';

/** 헤더의 선택적 로그인 버튼. 로그인해도 안 해도 사이트는 똑같이 쓸 수 있다. */
export function AuthButton({ userEmail }: { userEmail: string | null }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (userEmail) {
    const initial = userEmail[0].toUpperCase();
    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Account"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-black/50"
        >
          {initial}
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-10 z-50 w-48 rounded-lg bg-white p-2 text-left shadow-xl dark:bg-stone-900">
            <p className="truncate px-2 py-1 text-xs text-stone-400">{userEmail}</p>
            <button
              onClick={() => signOut()}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="rounded-full bg-black/30 px-3 py-1 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-black/50"
      >
        Sign in
      </button>
      <SignInModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
