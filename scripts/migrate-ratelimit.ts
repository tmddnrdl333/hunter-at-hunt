import './load-env';
import postgres from 'postgres';
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
async function main() {
  await c.unsafe(`create table if not exists public.admin_login_attempts (
    id integer generated always as identity primary key,
    ip text not null,
    created_at text not null
  );`);
  await c.unsafe('create index if not exists admin_attempts_ip_idx on public.admin_login_attempts (ip, created_at);');
  await c.unsafe(`create table if not exists public.comment_rate_log (
    id integer generated always as identity primary key,
    user_id uuid not null,
    created_at text not null
  );`);
  await c.unsafe('create index if not exists comment_rate_user_idx on public.comment_rate_log (user_id, created_at);');
  console.log('rate-limit tables ready');
  await c.end();
}
main();
