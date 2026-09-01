import { count, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getAuthedUser } from '@/lib/supabase/server';
import { parseIntId } from '@/lib/validate';

export const dynamic = 'force-dynamic';

/** 내 댓글 삭제. 대댓글이 있으면 soft delete("[deleted]" 표시), 없으면 완전 삭제 */
export async function DELETE(
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
    const [comment] = await db
      .select({ userId: schema.comments.userId })
      .from(schema.comments)
      .where(eq(schema.comments.id, id));
    if (!comment) {
      return Response.json({ error: 'not found' }, { status: 404 });
    }
    if (comment.userId !== user.id) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    const [{ replies }] = await db
      .select({ replies: count() })
      .from(schema.comments)
      .where(eq(schema.comments.parentId, id));
    if (replies > 0) {
      await db
        .update(schema.comments)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(schema.comments.id, id));
    } else {
      await db.delete(schema.comments).where(eq(schema.comments.id, id));
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[comments] delete error:', err);
    return Response.json({ error: 'internal' }, { status: 502 });
  }
}
