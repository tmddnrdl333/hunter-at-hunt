/**
 * DB 보안 설정 (멱등 — 여러 번 실행해도 안전). 실행: npx tsx scripts/db-security.ts
 *
 * 1. RLS 활성화: 모든 public 테이블 접근은 우리 서버(테이블 소유자, RLS 미적용)로만.
 *    Supabase Data API(anon key)를 통한 직접 읽기/쓰기를 차단한다.
 * 2. Before User Created Hook 함수: @ncsu.edu 외 이메일의 가입을 Auth 레벨에서 거부.
 *    (대시보드 Authentication → Hooks에서 이 함수를 선택해야 활성화됨)
 */
import './load-env';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 필요 — 이 스크립트는 Supabase 전용입니다.');
  process.exit(1);
}
const dbClient = postgres(process.env.DATABASE_URL, { prepare: false });

async function main() {
  // 1. RLS — 정책 없이 활성화하면 소유자 외 접근(anon/authenticated)이 전부 거부됨
  for (const table of ['events', 'raw_events', 'favorites']) {
    await dbClient.unsafe(`alter table public.${table} enable row level security;`);
    console.log(`RLS enabled: ${table}`);
  }

  // 2. 가입 도메인 제한 hook 함수
  await dbClient.unsafe(`
    create or replace function public.restrict_signup_domain(event jsonb)
    returns jsonb
    language plpgsql
    security definer
    as $$
    declare
      email text := lower(coalesce(event->'user'->>'email', ''));
    begin
      if email not like '%@ncsu.edu' then
        return jsonb_build_object(
          'error', jsonb_build_object(
            'http_code', 403,
            'message', 'Only @ncsu.edu accounts are allowed.'
          )
        );
      end if;
      return '{}'::jsonb;
    end;
    $$;
  `);
  await dbClient.unsafe(
    `grant execute on function public.restrict_signup_domain to supabase_auth_admin;`,
  );
  await dbClient.unsafe(
    `revoke execute on function public.restrict_signup_domain from authenticated, anon, public;`,
  );
  console.log('hook function created: public.restrict_signup_domain');

  await dbClient.end();
}

main().catch(async (err) => {
  console.error(err);
  await dbClient.end().catch(() => {});
  process.exit(1);
});
