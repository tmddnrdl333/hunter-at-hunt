import { createBrowserClient } from '@supabase/ssr';

/** Supabase Auth 설정 여부 — 없으면(데모 모드 등) 로그인 UI를 통째로 숨긴다 */
export const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
  // 로그아웃 토스트를 띄우기 위한 신호와 함께 홈으로
  window.location.href = '/?auth=signedout';
}
