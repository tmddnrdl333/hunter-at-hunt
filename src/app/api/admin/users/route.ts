import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { isAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** 관리자: 계정 정지/해제/삭제. body: { userId, action: 'ban'|'unban'|'delete', reason? } */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    userId?: unknown;
    action?: unknown;
    reason?: unknown;
  } | null;
  const userId = String(body?.userId ?? '');
  const action = body?.action;
  if (!/^[0-9a-f-]{36}$/.test(userId) || !['ban', 'unban', 'delete'].includes(action as string)) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  try {
    if (action === 'ban') {
      await db
        .insert(schema.bannedUsers)
        .values({
          userId,
          reason: typeof body?.reason === 'string' ? body.reason.slice(0, 200) : null,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing();
    } else if (action === 'unban') {
      await db.delete(schema.bannedUsers).where(eq(schema.bannedUsers.userId, userId));
    } else {
      // 계정 삭제 — auth.users에서 제거 (세션/identity는 Supabase FK cascade).
      // 작성 댓글은 남고 작성자는 'hunter'로 표시됨. 그 외 개인 데이터는 정리.
      const deleted = await db
        .delete(schema.authUsers)
        .where(eq(schema.authUsers.id, userId))
        .returning({ id: schema.authUsers.id });
      if (deleted.length === 0) {
        // 권한/RLS 문제로 조용히 0행 삭제되는 케이스를 성공으로 위장하지 않음
        return Response.json({ error: 'delete had no effect' }, { status: 502 });
      }
      await Promise.all([
        db.delete(schema.likes).where(eq(schema.likes.userId, userId)),
        db.delete(schema.attendance).where(eq(schema.attendance.userId, userId)),
        db.delete(schema.commentLikes).where(eq(schema.commentLikes.userId, userId)),
        db.delete(schema.commentReports).where(eq(schema.commentReports.userId, userId)),
        db.delete(schema.feedbackLog).where(eq(schema.feedbackLog.userId, userId)),
        db.delete(schema.commentRateLog).where(eq(schema.commentRateLog.userId, userId)),
        db.delete(schema.bannedUsers).where(eq(schema.bannedUsers.userId, userId)),
      ]);
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[admin users] error:', err);
    return Response.json({ error: 'internal' }, { status: 502 });
  }
}
