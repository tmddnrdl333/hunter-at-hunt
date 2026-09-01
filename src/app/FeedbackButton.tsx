'use client';

import { useState } from 'react';
import { useLockBodyScroll } from '@/lib/use-lock-scroll';
import { SignInModal } from './SignInModal';

/** 플로팅 독의 피드백 버튼 — 로그인 필요, 제출 시 운영자 이메일로 발송 */
export function FeedbackButton({
  userSignedIn,
  className,
}: {
  userSignedIn: boolean;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  useLockBodyScroll(open);

  const close = () => {
    setOpen(false);
    setStatus('idle');
  };

  const submit = async () => {
    if (!title.trim() || !content.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('sent');
      setTitle('');
      setContent('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <button
        onClick={() => (userSignedIn ? setOpen(true) : setSignInOpen(true))}
        className={className}
      >
        💬 Feedback
      </button>
      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        message="Sign in to send feedback."
      />
      {open && (
        <div
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl bg-white p-5 text-stone-800 shadow-xl dark:bg-stone-900 dark:text-stone-100"
          >
            {status === 'sent' ? (
              <div className="py-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/happy-wolf.png" alt="" className="mx-auto h-24 w-24" />
                <p className="font-display mt-2 font-bold">Thanks for the feedback!</p>
                <p className="mt-1 text-sm text-stone-500">The wolf will read it soon.</p>
                <button
                  onClick={close}
                  className="mt-4 rounded-lg bg-red-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <h2 className="font-display text-lg font-bold">Send feedback</h2>
                  <button
                    onClick={close}
                    aria-label="Close"
                    className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  maxLength={120}
                  className="mt-3 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800"
                />
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Ideas, bugs, missing events — anything helps."
                  rows={5}
                  maxLength={4000}
                  className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800"
                />
                {status === 'error' && (
                  <p className="mt-1 text-xs text-red-600">
                    Failed to send — please try again.
                  </p>
                )}
                <button
                  onClick={submit}
                  disabled={!title.trim() || !content.trim() || status === 'sending'}
                  className="mt-3 w-full rounded-lg bg-red-800 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
                >
                  {status === 'sending' ? 'Sending…' : 'Send'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
