'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignInModal } from '@/app/SignInModal';

const CROWD_OPTIONS = [
  { value: 'quiet', label: '😌 Quiet' },
  { value: 'moderate', label: '🙂 Moderate' },
  { value: 'packed', label: '😵 Packed' },
] as const;

const CHIP =
  'rounded-full border px-3 py-1 text-sm transition-all active:scale-95 border-stone-300 bg-white text-stone-700 hover:border-red-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200';
const CHIP_ACTIVE = 'rounded-full border px-3 py-1 text-sm border-red-800 bg-red-800 text-white';

/**
 * 이벤트 상세 우하단 플로팅: "Did you go?" → Going / I went / No.
 * Going = 좋아요로 연결, I went = 옵셔널 설문(Field Report 데이터).
 */
export function AttendanceWidget({
  eventId,
  signedIn,
  alreadyWent,
  startsAt,
}: {
  eventId: number;
  signedIn: boolean;
  alreadyWent: boolean;
  startsAt: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<'button' | 'ask' | 'survey' | 'done' | 'error' | 'closed'>(
    alreadyWent ? 'closed' : 'button',
  );
  /** 아직 시작 전인 이벤트에는 "I went" 대신 Going만 물어봄 (마운트 시점 기준) */
  const [started] = useState(() => new Date(startsAt).getTime() <= Date.now());
  const [signInOpen, setSignInOpen] = useState(false);
  const [visitedAt, setVisitedAt] = useState('');
  const [crowd, setCrowd] = useState<string | null>(null);
  const [foodRanOut, setFoodRanOut] = useState<boolean | null>(null);
  const [ranOutAt, setRanOutAt] = useState('');
  const [sending, setSending] = useState(false);

  const requireSignIn = () => setSignInOpen(true);

  const finish = (ok: boolean) => {
    if (ok) {
      setPhase('done');
      setTimeout(() => setPhase('closed'), 1800);
      router.refresh();
    } else {
      setPhase('error');
    }
  };

  const going = async () => {
    if (!signedIn) return requireSignIn();
    const res = await fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, liked: true }),
    }).catch(() => null);
    finish(!!res?.ok);
  };

  const submitSurvey = async () => {
    if (sending) return;
    setSending(true);
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, visitedAt, crowd, foodRanOut, ranOutAt }),
    }).catch(() => null);
    setSending(false);
    finish(!!res?.ok);
  };

  if (phase === 'closed') {
    return <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />;
  }

  return (
    <>
    <div className="fixed bottom-4 right-4 z-40">
      {phase === 'button' && (
        <button
          onClick={() => setPhase('ask')}
          className="rounded-2xl bg-red-800 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-950/40 transition-all hover:bg-red-700 active:scale-95"
        >
          {started ? '🐺 Did you go?' : '🐺 Going?'}
        </button>
      )}
      {phase !== 'button' && (
        <div className="w-72 rounded-2xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-700 dark:bg-stone-900">
          {phase === 'ask' && (
            <>
              <p className="text-sm font-semibold">
                {started ? 'Did you go to this event?' : 'Are you going to this event?'}
              </p>
              <div className="mt-3 flex gap-2">
                {started && (
                  <button
                    onClick={() => {
                      if (!signedIn) return requireSignIn();
                      setPhase('survey');
                    }}
                    className={CHIP}
                  >
                    ✅ I went
                  </button>
                )}
                <button onClick={going} className={CHIP}>
                  🙋 Going
                </button>
                <button onClick={() => setPhase('closed')} className={CHIP}>
                  ✕ No
                </button>
              </div>
            </>
          )}
          {phase === 'survey' && (
            <>
              <p className="text-sm font-semibold">How was the hunt? 🐺</p>
              <p className="mt-0.5 text-xs text-stone-400">All optional — helps fellow hunters.</p>
              <label className="mt-3 block text-xs font-semibold text-stone-500">
                When did you visit?
                <input
                  type="time"
                  value={visitedAt}
                  onChange={(e) => setVisitedAt(e.target.value)}
                  className="mt-1 block rounded-md border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-800"
                />
              </label>
              <p className="mt-3 text-xs font-semibold text-stone-500">How crowded?</p>
              <div className="mt-1 flex gap-1.5">
                {CROWD_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setCrowd(crowd === o.value ? null : o.value)}
                    className={crowd === o.value ? CHIP_ACTIVE : CHIP}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold text-stone-500">Did the food run out?</p>
              <div className="mt-1 flex items-center gap-1.5">
                <button
                  onClick={() => setFoodRanOut(foodRanOut === true ? null : true)}
                  className={foodRanOut === true ? CHIP_ACTIVE : CHIP}
                >
                  Yes
                </button>
                <button
                  onClick={() => setFoodRanOut(foodRanOut === false ? null : false)}
                  className={foodRanOut === false ? CHIP_ACTIVE : CHIP}
                >
                  No
                </button>
                {foodRanOut === true && (
                  <input
                    type="time"
                    value={ranOutAt}
                    onChange={(e) => setRanOutAt(e.target.value)}
                    aria-label="When did the food run out?"
                    className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-800"
                  />
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={submitSurvey}
                  disabled={sending}
                  className="flex-1 rounded-lg bg-red-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {sending ? 'Sending…' : 'Submit'}
                </button>
                <button
                  onClick={() => setPhase('closed')}
                  className="rounded-lg px-3 py-1.5 text-sm text-stone-400 hover:text-stone-600"
                >
                  Skip
                </button>
              </div>
            </>
          )}
          {phase === 'done' && (
            <p className="text-center text-sm font-semibold">Thanks, hunter! 🐺</p>
          )}
          {phase === 'error' && (
            <div className="text-center">
              <p className="text-sm font-semibold text-red-700">Something went wrong.</p>
              <button
                onClick={() => setPhase('ask')}
                className="mt-2 text-sm text-stone-400 underline hover:text-stone-600"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
    {/* 모달은 z-40 컨테이너 밖에서 렌더 — 스태킹 컨텍스트에 갇히지 않게 */}
    <SignInModal
      open={signInOpen}
      onClose={() => setSignInOpen(false)}
      message="Sign in to log your hunt."
    />
    </>
  );
}
