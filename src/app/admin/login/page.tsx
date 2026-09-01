'use client';

import { useState } from 'react';

/** 관리자 로그인 — 진입은 로그인 팝업의 늑대 이미지 클릭(이스터에그) */
export default function AdminLoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.href = '/admin';
    } else {
      setStatus('error');
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/happy-wolf.png" alt="" className="h-24 w-24" />
      <h1 className="font-display mt-2 text-xl font-bold">Alpha Wolf only 🐺</h1>
      <form onSubmit={submit} className="mt-4 w-full space-y-2">
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="ID"
          autoComplete="username"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800"
        />
        <button
          type="submit"
          disabled={!id || !password || status === 'sending'}
          className="w-full rounded-lg bg-red-800 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
        >
          {status === 'sending' ? 'Checking…' : 'Enter the den'}
        </button>
        {status === 'error' && (
          <p className="text-center text-sm text-red-600">Wrong credentials.</p>
        )}
      </form>
    </main>
  );
}
