import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서 호출된 경우 — 미들웨어가 세션을 갱신하므로 무시 가능
          }
        },
      },
    },
  );
}

export function isNcsuEmail(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase().endsWith('@ncsu.edu');
}

/**
 * 현재 로그인한 @ncsu.edu 사용자. 미로그인/타 도메인/정지 계정/미설정이면 null.
 * 보호가 필요한 서버 코드는 전부 이 함수를 거친다.
 */
export async function getAuthedUser(): Promise<User | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isNcsuEmail(user.email)) return null;
  const banned = await db
    .select({ userId: schema.bannedUsers.userId })
    .from(schema.bannedUsers)
    .where(eq(schema.bannedUsers.userId, user.id));
  if (banned.length > 0) return null;
  return user;
}
