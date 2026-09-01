import { runIngest } from '@/lib/ingest';
import { isAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** 관리자: 수집 파이프라인 수동 실행 */
export async function POST() {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runIngest();
    return Response.json(result);
  } catch (err) {
    console.error('[admin ingest] error:', err);
    return Response.json({ error: 'ingest failed' }, { status: 502 });
  }
}
