import { and, count, desc, eq, gt } from 'drizzle-orm';
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
    // 레이트리밋: 마지막 댓글 30초 경과 + 24시간 50개 미만
    const [last] = await db
      .select({ createdAt: schema.comments.createdAt })
      .from(schema.comments)
      .where(eq(schema.comments.userId, user.id))
      .orderBy(desc(schema.comments.createdAt))
      .limit(1);
    if (last && Date.now() - new Date(last.createdAt).getTime() < MIN_INTERVAL_MS) {
      return Response.json({ error: 'too fast' }, { status: 429 });
    }
    const dayAgo = new Date(Date.now() - 86400_000).toISOString();
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(schema.comments)
      .where(and(eq(schema.comments.userId, user.id), gt(schema.comments.createdAt, dayAgo)));
    if (recent >= DAILY_LIMIT) {
      return Response.json({ error: 'daily limit' }, { status: 429 });
    }

    // 대댓글은 2뎁스까지만: 부모는 같은 이벤트의 최상위 댓글이어야 함
    if (parentId != null) {
      const [parent] = await db
        .select({
          id: schema.comments.id,
          eventId: schema.comments.eventId,
          parentId: schema.comments.parentId,
          deletedAt: schema.comments.deletedAt,
        })
        .from(schema.comments)
        .where(eq(schema.comments.id, parentId));
      if (!parent || parent.eventId !== eventId || parent.parentId !== null) {
        return Response.json({ error: 'invalid parent' }, { status: 400 });
      }
    }

    const [created] = await db
      .insert(schema.comments)
      .values({
        eventId,
        userId: user.id,
        parentId,
        body,
        createdAt: new Date().toISOString(),
      })
      .returning({ id: schema.comments.id });
    return Response.json({ ok: true, id: created.id });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return Response.json({ error: 'event not found' }, { status: 404 });
    }
    console.error('[comments] create error:', err);
    return Response.json({ error: 'internal' }, { status: 502 });
  }
}
