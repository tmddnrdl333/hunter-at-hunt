/**
 * DB 보안 설정 (멱등 — 여러 번 실행해도 안전). 실행: npx tsx scripts/db-security.ts
 *
 * 1. RLS 활성화: public 스키마의 "모든" 테이블을 pg_tables에서 조회해 적용.
 *    (테이블명 하드코딩 금지 — 과거 favorites→likes rename 때 목록이 어긋난 적 있음)
 *    모든 접근은 우리 서버(테이블 소유자, RLS 미적용)로만; Data API(anon key) 차단.
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
  const tables = await dbClient<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' order by tablename
  `;
  for (const { tablename } of tables) {
    await dbClient.unsafe(`alter table public."${tablename}" enable row level security;`);
  }

  // 적용 결과를 눈으로 검증할 수 있게 출력
  const status = await dbClient<{ relname: string; relrowsecurity: boolean }[]>`
    select relname, relrowsecurity from pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'r'
    order by relname
  `;
  for (const r of status) {
    console.log(`RLS ${r.relrowsecurity ? 'enabled ' : 'MISSING!'}: ${r.relname}`);
  }
  if (status.some((r) => !r.relrowsecurity)) {
    throw new Error('RLS가 켜지지 않은 테이블이 있습니다.');
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
  console.log('hook function ready: public.restrict_signup_domain');

  await dbClient.end();
}

main().catch(async (err) => {
  console.error(err);
  await dbClient.end().catch(() => {});
  process.exit(1);
});
