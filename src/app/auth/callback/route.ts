import { NextResponse } from 'next/server';
import { createClient, isNcsuEmail } from '@/lib/supabase/server';

/**
 * Google OAuth 콜백 (PKCE). 코드를 세션으로 교환하고 원래 페이지로 복귀.
 * hd 파라미터는 우회 가능하므로 여기서도 도메인을 재검증한다
 * (신규 가입은 Before User Created Hook이 먼저 막지만, 이중 방어).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // open redirect 방지: 문자열 검사 대신 파싱 결과의 origin을 비교 —
  // "/\evil.com" 같은 백슬래시 파서 quirk까지 한 번에 차단된다
  let next = '/';
  try {
    const parsed = new URL(searchParams.get('next') ?? '/', origin);
    if (parsed.origin === origin) next = parsed.pathname + parsed.search;
  } catch {
    /* 파싱 불가 → '/' 유지 */
  }

  if (!code) {
    // 사용자가 구글 화면에서 취소한 경우 등 (?error=access_denied)
    const providerError = searchParams.get('error');
    return NextResponse.redirect(
      `${origin}/?auth_error=${providerError ? 'denied' : 'missing_code'}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Auth Hook이 타 도메인 가입을 거부한 경우도 여기로 온다
    return NextResponse.redirect(`${origin}/?auth_error=denied`);
  }

  if (!isNcsuEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?auth_error=domain`);
  }

  // 로그인 성공 토스트 신호를 붙여서 원래 페이지로
  const dest = new URL(next, origin);
  dest.searchParams.set('auth', 'signedin');
  return NextResponse.redirect(dest);
}
