'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** 관리자 액션 버튼 — POST 후 새로고침. confirm 문구가 있으면 확인창 선행 */
export function AdminAction({
  label,
  url,
  body,
  confirm,
  danger,
  redirectTo,
}: {
  label: string;
  url: string;
  body?: Record<string, unknown>;
  confirm?: string;
  danger?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      if (redirectTo) window.location.href = redirectTo;
      else router.refresh();
    } else {
      window.alert('Action failed.');
    }
  };

  return (
    <button
      onClick={run}
      disabled={busy}
      className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-40 ${
        danger
          ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950'
          : 'border-stone-300 text-stone-600 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800'
      }`}
    >
      {busy ? '…' : label}
    </button>
  );
}
