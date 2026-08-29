/**
 * 수집 파이프라인 로컬 실행용 래퍼.
 * 실행: npm run ingest  (옵션: --days=30 --no-llm)
 * 실제 로직은 src/lib/ingest.ts — Vercel Cron route와 공유.
 */
import './load-env';
import { dbClient } from '../src/lib/db';
import { runIngest } from '../src/lib/ingest';

const days = Number(
  process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 14,
);
const useLlm = !process.argv.includes('--no-llm');

runIngest({ days, useLlm })
  .then(async () => {
    await dbClient.end();
  })
  .catch(async (err) => {
    console.error(err);
    await dbClient.end().catch(() => {});
    process.exit(1);
  });
