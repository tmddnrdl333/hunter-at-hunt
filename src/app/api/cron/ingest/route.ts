import { runIngest } from '@/lib/ingest';

/** LLM 배치 + DB upsert에 시간이 걸리므로 함수 실행 한도를 늘림 (초) */
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron이 매일 호출하는 수집 엔드포인트.
 * CRON_SECRET 환경변수를 설정하면 Vercel이 Authorization: Bearer <secret>을
 * 자동으로 붙여 호출한다. 외부인의 임의 호출(LLM 쿼터 소모)을 막는다.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await runIngest();
  return Response.json(result);
}
