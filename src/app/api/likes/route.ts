import { and, eq } from 'drizzle-orm';
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

/** 좋아요 토글 (로그인 필수). body: { eventId: number } */
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { eventId?: unknown } | null;
  const eventId = Number(body?.eventId);
  if (!Number.isInteger(eventId)) {
    return Response.json({ error: 'invalid eventId' }, { status: 400 });
  }

  const cond = and(
    eq(schema.likes.userId, user.id),
    eq(schema.likes.eventId, eventId),
  );
  const existing = await db.select().from(schema.likes).where(cond);
  if (existing.length > 0) {
    await db.delete(schema.likes).where(cond);
    return Response.json({ liked: false });
  }
  await db.insert(schema.likes).values({
    userId: user.id,
    eventId,
    createdAt: new Date().toISOString(),
  });
  return Response.json({ liked: true });
}
