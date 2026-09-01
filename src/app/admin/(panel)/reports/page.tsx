import Link from 'next/link';
import { count, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { AdminAction } from '../../AdminAction';

export const dynamic = 'force-dynamic';

export default async function AdminReports() {
  // 신고가 1건이라도 있는 댓글을 신고 수 내림차순으로
  const reported = await db
    .select({
      commentId: schema.commentReports.commentId,
      reports: count(),
    })
    .from(schema.commentReports)
    .groupBy(schema.commentReports.commentId)
    .orderBy(desc(count()));

  const rows = await Promise.all(
    reported.map(async (r) => {
      const [row] = await db
        .select({
          id: schema.comments.id,
          body: schema.comments.body,
          createdAt: schema.comments.createdAt,
          hiddenAt: schema.comments.hiddenAt,
          eventId: schema.comments.eventId,
          email: schema.authUsers.email,
          eventTitle: schema.events.title,
        })
        .from(schema.comments)
        .leftJoin(schema.authUsers, eq(schema.comments.userId, schema.authUsers.id))
        .leftJoin(schema.events, eq(schema.comments.eventId, schema.events.id))
        .where(eq(schema.comments.id, r.commentId));
      return row ? { ...row, reports: r.reports } : null;
    }),
  );
  const items = rows.filter(Boolean) as NonNullable<(typeof rows)[number]>[];

  return (
    <div>
      <h1 className="font-display text-xl font-bold">
        Reported comments{' '}
        <span className="text-sm font-normal text-stone-400">{items.length}</span>
      </h1>
      {items.length === 0 && (
        <p className="mt-6 text-sm text-stone-400">신고된 댓글이 없습니다. 평화롭네요 🐺</p>
      )}
      <div className="mt-4 space-y-3">
        {items.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
              <span className="font-semibold text-stone-600 dark:text-stone-300">
                {c.email ?? 'hunter'}
              </span>
              <span>
                {new Date(c.createdAt).toLocaleString('en-US', {
                  timeZone: 'America/New_York',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                🚩 {c.reports} report{c.reports > 1 ? 's' : ''}
              </span>
              {c.hiddenAt && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  HIDDEN
                </span>
              )}
              {c.eventTitle && (
                <Link
                  href={`/event/${c.eventId}`}
                  className="underline hover:text-stone-600"
                >
                  {c.eventTitle.slice(0, 40)}
                </Link>
              )}
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{c.body}</p>
            <div className="mt-3 flex gap-1">
              <AdminAction
                label="Restore"
                url="/api/admin/comments"
                body={{ commentId: c.id, action: 'restore' }}
                confirm="이 댓글을 복구하고 신고 기록을 초기화할까요?"
              />
              <AdminAction
                label="Delete permanently"
                url="/api/admin/comments"
                body={{ commentId: c.id, action: 'delete' }}
                confirm="이 댓글을 완전히 삭제할까요?"
                danger
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
