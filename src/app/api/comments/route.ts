import { and, count, desc, eq, gt, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getAuthedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_BODY = 1000;
const MAX_INT4 = 2147483647;
/** 도배 방지: 30초당 1개, 24시간 50개 */
const MIN_INTERVAL_MS = 30_000;
const DAILY_LIMIT = 50;

/** 댓글 작성 (로그인 필수). body: { eventId, body, parentId? } */
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const payload = (await req.json().catch(() => null)) as {
    eventId?: unknown;
    body?: unknown;
    parentId?: unknown;
  } | null;

  const eventId = payload?.eventId;
  const body = String(payload?.body ?? '').trim();
  if (
    typeof eventId !== 'number' ||
    !Number.isSafeInteger(eventId) ||
    eventId <= 0 ||
    eventId > MAX_INT4 ||
    !body ||
    body.length > MAX_BODY
  ) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  let parentId: number | null = null;
  if (payload?.parentId != null) {
    if (
      typeof payload.parentId !== 'number' ||
      !Number.isSafeInteger(payload.parentId) ||
      payload.parentId <= 0 ||
      payload.parentId > MAX_INT4
    ) {
      return Response.json({ error: 'invalid parentId' }, { status: 400 });
    }
    parentId = payload.parentId;
  }

  try {
    // 대댓글은 2뎁스까지만: 부모는 같은 이벤트의, 삭제/숨김되지 않은 최상위 댓글이어야 함
    if (parentId != null) {
      const [parent] = await db
        .select({
          id: schema.comments.id,
          eventId: schema.comments.eventId,
          parentId: schema.comments.parentId,
          deletedAt: schema.comments.deletedAt,
          hiddenAt: schema.comments.hiddenAt,
        })
        .from(schema.comments)
        .where(eq(schema.comments.id, parentId));
      if (
        !parent ||
        parent.eventId !== eventId ||
        parent.parentId !== null ||
        parent.deletedAt !== null ||
        parent.hiddenAt !== null
      ) {
        return Response.json({ error: 'invalid parent' }, { status: 400 });
      }
    }

    // 레이트리밋: 트랜잭션 + 사용자별 advisory lock으로 병렬 요청 직렬화(check-then-act 경쟁 차단),
    // 기록은 댓글 삭제와 무관한 comment_rate_log 기준(삭제로 리셋 불가)
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);

      const [last] = await tx
        .select({ createdAt: schema.commentRateLog.createdAt })
        .from(schema.commentRateLog)
        .where(eq(schema.commentRateLog.userId, user.id))
        .orderBy(desc(schema.commentRateLog.createdAt))
        .limit(1);
      if (last && Date.now() - new Date(last.createdAt).getTime() < MIN_INTERVAL_MS) {
        return { rateLimited: true as const };
      }
      const dayAgo = new Date(Date.now() - 86400_000).toISOString();
      const [{ recent }] = await tx
        .select({ recent: count() })
        .from(schema.commentRateLog)
        .where(
          and(
            eq(schema.commentRateLog.userId, user.id),
            gt(schema.commentRateLog.createdAt, dayAgo),
          ),
        );
      if (recent >= DAILY_LIMIT) {
        return { rateLimited: true as const };
      }

      const now = new Date().toISOString();
      await tx.insert(schema.commentRateLog).values({ userId: user.id, createdAt: now });
      const [created] = await tx
        .insert(schema.comments)
        .values({ eventId, userId: user.id, parentId, body, createdAt: now })
        .returning({ id: schema.comments.id });
      return { rateLimited: false as const, id: created.id };
    });

    if (result.rateLimited) {
      return Response.json({ error: 'rate limited' }, { status: 429 });
    }
    return Response.json({ ok: true, id: result.id });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return Response.json({ error: 'event not found' }, { status: 404 });
    }
    console.error('[comments] create error:', err);
    return Response.json({ error: 'internal' }, { status: 502 });
  }
}
