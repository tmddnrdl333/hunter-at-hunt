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
  // open redirect 방지: 상대 경로만 허용
  const nextParam = searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
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

  return NextResponse.redirect(`${origin}${next}`);
}
