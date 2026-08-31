import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getAuthedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** 내 즐겨찾기 이벤트 id 목록 (로그인 필수) */
export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rows = await db
    .select({ eventId: schema.favorites.eventId })
    .from(schema.favorites)
    .where(eq(schema.favorites.userId, user.id));
  return Response.json({ eventIds: rows.map((r) => r.eventId) });
}

/** 즐겨찾기 토글 (로그인 필수). body: { eventId: number } */
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
    eq(schema.favorites.userId, user.id),
    eq(schema.favorites.eventId, eventId),
  );
  const existing = await db.select().from(schema.favorites).where(cond);
  if (existing.length > 0) {
    await db.delete(schema.favorites).where(cond);
    return Response.json({ saved: false });
  }
  await db.insert(schema.favorites).values({
    userId: user.id,
    eventId,
    createdAt: new Date().toISOString(),
  });
  return Response.json({ saved: true });
}
