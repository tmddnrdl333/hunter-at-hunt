import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL 환경변수가 없습니다 (.env.local 확인)');
}

// Supabase transaction pooler는 prepared statement를 지원하지 않음
const client = postgres(url, { prepare: false });

export const db = drizzle(client, { schema });
/** 단발성 스크립트에서 접속 종료용 */
export const dbClient = client;
export { schema };
