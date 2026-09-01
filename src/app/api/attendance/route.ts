import { db, schema } from '@/lib/db';
import { getAuthedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_INT4 = 2147483647;
const CROWD_VALUES = ['quiet', 'moderate', 'packed'] as const;

/**
 * "I went" 참석 리포트 제출 (로그인 필수, 이벤트당 1회 — 재제출 시 갱신).
 * body: { eventId, visitedAt?, crowd?, foodRanOut?, ranOutAt? } — 설문은 전부 옵셔널
 */
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    eventId?: unknown;
    visitedAt?: unknown;
    crowd?: unknown;
    foodRanOut?: unknown;
    ranOutAt?: unknown;
  } | null;

  const eventId = body?.eventId;
  if (
    typeof eventId !== 'number' ||
    !Number.isSafeInteger(eventId) ||
    eventId <= 0 ||
    eventId > MAX_INT4
  ) {
    return Response.json({ error: 'invalid eventId' }, { status: 400 });
  }
  const visitedAt =
    typeof body?.visitedAt === 'string' && body.visitedAt.trim()
      ? body.visitedAt.trim().slice(0, 20)
      : null;
  const crowd =
    typeof body?.crowd === 'string' &&
    (CROWD_VALUES as readonly string[]).includes(body.crowd)
      ? body.crowd
      : null;
  const foodRanOut = typeof body?.foodRanOut === 'boolean' ? body.foodRanOut : null;
  const ranOutAt =
    foodRanOut && typeof body?.ranOutAt === 'string' && body.ranOutAt.trim()
      ? body.ranOutAt.trim().slice(0, 20)
      : null;

  try {
    await db
      .insert(schema.attendance)
      .values({
        userId: user.id,
        eventId,
        visitedAt,
        crowd,
        foodRanOut,
        ranOutAt,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [schema.attendance.userId, schema.attendance.eventId],
        set: { visitedAt, crowd, foodRanOut, ranOutAt },
      });
    return Response.json({ ok: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return Response.json({ error: 'event not found' }, { status: 404 });
    }
    console.error('[attendance] error:', err);
    return Response.json({ error: 'internal' }, { status: 502 });
  }
}
