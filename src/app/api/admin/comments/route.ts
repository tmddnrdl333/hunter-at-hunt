import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { isAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * 관리자: 신고 댓글 처리. body: { commentId, action: 'restore'|'delete' }
 * restore: 숨김 해제 + 기존 신고 기록 삭제(문턱 리셋)
 * delete: 완전 삭제(좋아요/신고는 FK cascade)
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    commentId?: unknown;
    action?: unknown;
  } | null;
  const commentId = body?.commentId;
  if (
    typeof commentId !== 'number' ||
    !Number.isSafeInteger(commentId) ||
    commentId <= 0 ||
    !['restore', 'delete'].includes(body?.action as string)
  ) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  try {
    if (body!.action === 'restore') {
      await db
        .update(schema.comments)
        .set({ hiddenAt: null })
        .where(eq(schema.comments.id, commentId));
      await db
        .delete(schema.commentReports)
        .where(eq(schema.commentReports.commentId, commentId));
    } else {
      await db.delete(schema.comments).where(eq(schema.comments.id, commentId));
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[admin comments] error:', err);
    return Response.json({ error: 'internal' }, { status: 502 });
  }
}
