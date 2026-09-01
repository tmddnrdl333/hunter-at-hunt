import { eq, sql } from 'drizzle-orm';
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
  // 시각은 HH:MM(24h) 형식만 허용 — 공개 페이지에 그대로 집계되므로 자유 문자열 금지
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const parseTime = (v: unknown) =>
    typeof v === 'string' && TIME_RE.test(v.trim()) ? v.trim() : null;
  const visitedAt = parseTime(body?.visitedAt);
  const crowd =
    typeof body?.crowd === 'string' &&
    (CROWD_VALUES as readonly string[]).includes(body.crowd)
      ? body.crowd
      : null;
  const foodRanOut = typeof body?.foodRanOut === 'boolean' ? body.foodRanOut : null;
  const ranOutAt = foodRanOut ? parseTime(body?.ranOutAt) : null;

  try {
    // 아직 시작하지 않은 이벤트에는 "I went"를 받을 수 없음
    const [event] = await db
      .select({ startsAt: schema.events.startsAt })
      .from(schema.events)
      .where(eq(schema.events.id, eventId));
    if (!event) {
      return Response.json({ error: 'event not found' }, { status: 404 });
    }
    if (new Date(event.startsAt).getTime() > Date.now()) {
      return Response.json({ error: 'event has not started' }, { status: 400 });
    }

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
        // 재제출 시 새로 답한 항목만 갱신 (빈 값이 기존 답변을 지우지 않게)
        set: {
          visitedAt: sql`coalesce(excluded.visited_at, ${schema.attendance.visitedAt})`,
          crowd: sql`coalesce(excluded.crowd, ${schema.attendance.crowd})`,
          foodRanOut: sql`coalesce(excluded.food_ran_out, ${schema.attendance.foodRanOut})`,
          ranOutAt: sql`coalesce(excluded.ran_out_at, ${schema.attendance.ranOutAt})`,
        },
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
