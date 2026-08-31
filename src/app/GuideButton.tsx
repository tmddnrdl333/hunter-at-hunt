'use client';

import { useState } from 'react';

/** 헤더 우상단 가이드 버튼 + 서비스 소개 팝업 */
export function GuideButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="How to use"
        className="rounded-full bg-black/30 px-3 py-1 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-black/50"
      >
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
              className="mt-2 inline-block text-sm font-medium text-red-800 underline underline-offset-2 hover:text-red-600 dark:text-red-300"
            >
              View the project on GitHub →
            </a>
          </div>
        </div>
      )}
    </>
  );
}
