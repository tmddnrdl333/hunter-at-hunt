import { and, count, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getAuthedUser } from '@/lib/supabase/server';
import { parseIntId } from '@/lib/validate';

export const dynamic = 'force-dynamic';

/** 댓글 좋아요 토글 (로그인 필수) */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const id = parseIntId((await params).id);
  if (id == null) {
    return Response.json({ error: 'invalid id' }, { status: 400 });
  }
  try {
    const cond = and(
      eq(schema.commentLikes.userId, user.id),
      eq(schema.commentLikes.commentId, id),
    );
    const existing = await db.select().from(schema.commentLikes).where(cond);
    if (existing.length > 0) {
      await db.delete(schema.commentLikes).where(cond);
    } else {
      await db
        .insert(schema.commentLikes)
        .values({ userId: user.id, commentId: id, createdAt: new Date().toISOString() })
        .onConflictDoNothing();
    }
    const [{ likeCount }] = await db
      .select({ likeCount: count() })
      .from(schema.commentLikes)
      .where(eq(schema.commentLikes.commentId, id));
    return Response.json({ liked: existing.length === 0, likeCount });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return Response.json({ error: 'comment not found' }, { status: 404 });
    }
    console.error('[comment like] error:', err);
    return Response.json({ error: 'internal' }, { status: 502 });
  }
}
