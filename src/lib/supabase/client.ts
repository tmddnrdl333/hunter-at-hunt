import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Google OAuth 시작. hd=ncsu.edu로 NC State 계정만 선택지에 뜨게 한다.
 * (hd는 UI 힌트일 뿐 우회 가능 — 실제 차단은 서버/Auth Hook에서)
 * next: 로그인 완료 후 돌아갈 경로 (기본: 현재 페이지)
 */
export async function signInWithGoogle(next?: string) {
  const supabase = createClient();
  const target = next ?? window.location.pathname + window.location.search;
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
      queryParams: { hd: 'ncsu.edu', prompt: 'select_account' },
    },
  });
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  // 하드 내비게이션 의도: 서버 렌더 상태(좋아요/계정 UI)를 세션 없이 다시 받아야 함
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/?auth=signedout';
}
