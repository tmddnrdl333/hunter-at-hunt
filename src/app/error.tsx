'use client';

/** 전역 클라이언트 에러 바운더리 — 한 컴포넌트의 예외가 페이지 전체를 백지로 만드는 것 방지 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center px-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/not-found.png" alt="" className="h-32 w-32 opacity-90" />
      <h1 className="font-display mt-2 text-xl font-bold">Something went wrong</h1>
      <p className="mt-1 text-sm text-stone-500">
        The wolf tripped over something. Try again?
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-red-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
      >
        Reload
      </button>
    </main>
  );
}
