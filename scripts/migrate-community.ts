/** community 기능 테이블 생성 (멱등). 실행 후 db-security.ts로 RLS 적용할 것. */
import './load-env';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 필요');
  process.exit(1);
}
const c = postgres(process.env.DATABASE_URL, { prepare: false });

async function main() {
  await c.unsafe(`
    create table if not exists public.comments (
      id integer generated always as identity primary key,
      event_id integer not null references public.events(id) on delete cascade,
      user_id uuid not null,
      parent_id integer references public.comments(id) on delete cascade,
      body text not null,
      created_at text not null,
      hidden_at text,
      deleted_at text
    );
  `);
  await c.unsafe(
    `create index if not exists comments_event_idx on public.comments (event_id, created_at);`,
  );
  await c.unsafe(`
    create table if not exists public.comment_likes (
      user_id uuid not null,
      comment_id integer not null references public.comments(id) on delete cascade,
      created_at text not null,
      constraint comment_likes_pk primary key (user_id, comment_id)
    );
  `);
  await c.unsafe(`
    create table if not exists public.comment_reports (
      user_id uuid not null,
      comment_id integer not null references public.comments(id) on delete cascade,
      created_at text not null,
      constraint comment_reports_pk primary key (user_id, comment_id)
    );
  `);
  await c.unsafe(`
    create table if not exists public.attendance (
      user_id uuid not null,
      event_id integer not null references public.events(id) on delete cascade,
      visited_at text,
      crowd text,
      food_ran_out boolean,
      ran_out_at text,
      created_at text not null,
      constraint attendance_pk primary key (user_id, event_id)
    );
  `);
  await c.unsafe(`
    create table if not exists public.banned_users (
      user_id uuid primary key,
      reason text,
      created_at text not null
    );
  `);
  console.log('community tables ready');
  await c.end();
}

main().catch(async (err) => {
  console.error(err);
  await c.end().catch(() => {});
  process.exit(1);
});
