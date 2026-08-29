import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

const DB_DIR = path.join(process.cwd(), 'data');
mkdirSync(DB_DIR, { recursive: true });

const sqlite = new Database(path.join(DB_DIR, 'app.db'));
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
export { schema };
