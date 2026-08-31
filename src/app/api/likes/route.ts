import { and, count, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getAuthedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** 내가 좋아요한 이벤트 id 목록 (로그인 필수) */
export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rows = await db
    .select({ eventId: schema.likes.eventId })
    .from(schema.likes)
    .where(eq(schema.likes.userId, user.id));
  return Response.json({ eventIds: rows.map((r) => r.eventId) });
}

/**
 * 좋아요 설정 (로그인 필수). body: { eventId: number, liked: boolean }
 * 토글이 아닌 목표 상태 지정 + upsert라 연타/재시도에도 중복이 생기지 않고(멱등),
 * 응답으로 서버가 계산한 정확한 카운트를 돌려줘 클라이언트 표시를 교정한다.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    eventId?: unknown;
    liked?: unknown;
  } | null;
  const eventId = Number(body?.eventId);
  if (!Number.isInteger(eventId) || typeof body?.liked !== 'boolean') {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  if (body.liked) {
    await db
      .insert(schema.likes)
      .values({ userId: user.id, eventId, createdAt: new Date().toISOString() })
      .onConflictDoNothing();
  } else {
    await db
      .delete(schema.likes)
      .where(
        and(eq(schema.likes.userId, user.id), eq(schema.likes.eventId, eventId)),
      );
  }

  const [{ likeCount }] = await db
    .select({ likeCount: count() })
    .from(schema.likes)
    .where(eq(schema.likes.eventId, eventId));
  return Response.json({ liked: body.liked, likeCount });
}
