import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;

let db: PostgresJsDatabase<typeof schema>;
let closeDb: () => Promise<void>;

if (url) {
  // Supabase transaction pooler는 prepared statement를 지원하지 않음
  const client = postgres(url, { prepare: false });
  db = drizzlePostgres(client, { schema });
  closeDb = async () => {
    await client.end();
  };
} else {
  // 데모 모드: DATABASE_URL이 없으면 로컬 파일 기반 PGlite(내장 Postgres)로 동작.
  // 같은 Postgres 방언이라 스키마/쿼리 코드가 전부 그대로 돌아간다.
  console.warn('[db] DATABASE_URL 없음 → 로컬 데모 모드 (PGlite, ./data/pglite)');
  const client = new PGlite('./data/pglite');
  // 런타임 API가 동일하므로 타입만 postgres-js 쪽으로 통일
  db = drizzlePglite(client, { schema }) as unknown as PostgresJsDatabase<typeof schema>;
  closeDb = async () => {
    await client.close();
  };
}

export { closeDb, db, schema };
