import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 세션 토큰 갱신용 미들웨어. 로그인을 강제하지 않는다 —
 * 만료된 세션 쿠키를 갱신해서 서버 컴포넌트가 항상 유효한 세션을 보게 할 뿐.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() 호출이 곧 토큰 갱신 트리거
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    // 정적 자원과 cron 엔드포인트는 제외
    '/((?!_next/static|_next/image|api/cron|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)',
  ],
};
