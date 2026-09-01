import { count, eq, isNull, and } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getAuthedUser } from '@/lib/supabase/server';
import { parseIntId } from '@/lib/validate';

export const dynamic = 'force-dynamic';

/** 서로 다른 사용자 신고가 이 수에 도달하면 자동 숨김 (관리자 검토 대상) */
const AUTO_HIDE_THRESHOLD = 3;

/** 댓글 신고 (로그인 필수, 계정당 1회 — PK로 중복 차단) */
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
    // 자기 댓글은 신고 불가 (자동숨김 3인 중 1인이 작성자 본인이 되는 것 방지)
    const [target] = await db
      .select({ userId: schema.comments.userId })
      .from(schema.comments)
      .where(eq(schema.comments.id, id));
    if (!target) {
      return Response.json({ error: 'comment not found' }, { status: 404 });
    }
    if (target.userId === user.id) {
      return Response.json({ error: 'cannot report own comment' }, { status: 400 });
    }

    await db
      .insert(schema.commentReports)
      .values({ userId: user.id, commentId: id, createdAt: new Date().toISOString() })
      .onConflictDoNothing();

    const [{ reports }] = await db
      .select({ reports: count() })
      .from(schema.commentReports)
      .where(eq(schema.commentReports.commentId, id));

    if (reports >= AUTO_HIDE_THRESHOLD) {
      await db
        .update(schema.comments)
        .set({ hiddenAt: new Date().toISOString() })
        .where(and(eq(schema.comments.id, id), isNull(schema.comments.hiddenAt)));
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return Response.json({ error: 'comment not found' }, { status: 404 });
    }
    console.error('[comment report] error:', err);
    return Response.json({ error: 'internal' }, { status: 502 });
  }
}
