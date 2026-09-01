'use client';

import { useState } from 'react';
import { useEscapeKey } from '@/lib/use-escape';
import { useLockBodyScroll } from '@/lib/use-lock-scroll';

/** 가이드 버튼 + 서비스 소개 팝업 (플로팅 독 안에서 사용) */
export function GuideButton({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  useLockBodyScroll(open);
  useEscapeKey(open, () => setOpen(false));

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="How to use" className={className}>
        ? Guide
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl bg-white p-5 text-stone-800 shadow-xl dark:bg-stone-900 dark:text-stone-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/happy-wolf.png"
              alt=""
              className="mx-auto -mt-1 h-28 w-28"
            />
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-bold">What is this?</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed">
              Hunter at Hunt gathers NC State campus events every morning —
              and sniffs out the ones giving away <b>free food, drinks,
              t-shirts, and goodies</b>.
            </p>
            <h3 className="mt-4 text-sm font-bold">How to use</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed">
              <li>
                Tap <b>🍕 Free Food</b> (or any chip) to filter. Tap again to
                clear.
              </li>
              <li>
                Narrow by day with <b>Today / Tomorrow / 📅 Dates</b>.
              </li>
              <li>Tap an event card to open its original page.</li>
            </ul>
            <p className="mt-4 text-xs text-stone-400">
              Data refreshes daily around 7 AM ET from official NC State
              sources.
            </p>
            <hr className="my-4 border-stone-200 dark:border-stone-700" />
            <h3 className="text-sm font-bold">Who made this?</h3>
            <p className="mt-1 text-sm leading-relaxed">
              Hi, I&apos;m <b>Seungwook Jung</b> — from South Korea, studying
              at NC State. Campus events were scattered across too many sites,
              so I built one place to catch them all. Hope it helps you never
              miss a good one (or a free slice). 🍕
            </p>
            <a
              href="https://github.com/tmddnrdl333/hunter-at-hunt"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-red-800 underline underline-offset-2 hover:text-red-600 dark:text-red-300"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 fill-current">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              View the project on GitHub →
            </a>
          </div>
        </div>
      )}
    </>
  );
}
