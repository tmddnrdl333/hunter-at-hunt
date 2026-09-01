import { redirect } from 'next/navigation';
import { count, desc, eq } from 'drizzle-orm';
import { isAdmin } from '@/lib/admin-auth';
import { db, schema } from '@/lib/db';
import { AdminAction } from '../../AdminAction';

export const dynamic = 'force-dynamic';

export default async function AdminUsers() {
  if (!(await isAdmin())) redirect('/admin/login');

  const [users, commentCounts, likeGiven, likesReceived, reportsReceived, banned] =
    await Promise.all([
      db
        .select({
          id: schema.authUsers.id,
          email: schema.authUsers.email,
          createdAt: schema.authUsers.createdAt,
        })
        .from(schema.authUsers)
        .orderBy(desc(schema.authUsers.createdAt))
        .limit(500),
      db
        .select({ userId: schema.comments.userId, n: count() })
        .from(schema.comments)
        .groupBy(schema.comments.userId),
      db
        .select({ userId: schema.likes.userId, n: count() })
        .from(schema.likes)
        .groupBy(schema.likes.userId),
      // 이 사용자의 댓글이 받은 좋아요 수
      db
        .select({ userId: schema.comments.userId, n: count() })
        .from(schema.commentLikes)
        .innerJoin(schema.comments, eq(schema.commentLikes.commentId, schema.comments.id))
        .groupBy(schema.comments.userId),
      // 이 사용자의 댓글이 받은 신고 수
      db
        .select({ userId: schema.comments.userId, n: count() })
        .from(schema.commentReports)
        .innerJoin(schema.comments, eq(schema.commentReports.commentId, schema.comments.id))
        .groupBy(schema.comments.userId),
      db.select().from(schema.bannedUsers),
    ]);

  const toMap = (rows: { userId: string; n: number }[]) =>
    new Map(rows.map((r) => [r.userId, r.n]));
  const commentsBy = toMap(commentCounts);
  const likesBy = toMap(likeGiven);
  const likesRecvBy = toMap(likesReceived);
  const reportsBy = toMap(reportsReceived);
  const bannedSet = new Set(banned.map((b) => b.userId));

  return (
    <div>
      <h1 className="font-display text-xl font-bold">
        Users <span className="text-sm font-normal text-stone-400">{users.length}</span>
      </h1>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400 dark:border-stone-700">
              <th className="py-2 pr-2">Email</th>
              <th className="px-2 py-2 text-right">Joined</th>
              <th className="px-2 py-2 text-right">Comments</th>
              <th className="px-2 py-2 text-right">Likes given</th>
              <th className="px-2 py-2 text-right">Likes recv</th>
              <th className="px-2 py-2 text-right">Reports recv</th>
              <th className="px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-stone-100 dark:border-stone-800"
              >
                <td className="py-2 pr-2">
                  {u.email}
                  {bannedSet.has(u.id) && (
                    <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                      BANNED
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-right text-stone-400">
                  {u.createdAt
                    ? new Date(u.createdAt).toLocaleDateString('en-US', {
                        timeZone: 'America/New_York',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {commentsBy.get(u.id) ?? 0}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {likesBy.get(u.id) ?? 0}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {likesRecvBy.get(u.id) ?? 0}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {reportsBy.get(u.id) ?? 0}
                </td>
                <td className="px-2 py-2">
                  <span className="flex justify-end gap-1">
                    {bannedSet.has(u.id) ? (
                      <AdminAction
                        label="Unban"
                        url="/api/admin/users"
                        body={{ userId: u.id, action: 'unban' }}
                      />
                    ) : (
                      <AdminAction
                        label="Ban"
                        url="/api/admin/users"
                        body={{ userId: u.id, action: 'ban' }}
                        confirm={`${u.email} 계정을 정지할까요?`}
                        danger
                      />
                    )}
                    <AdminAction
                      label="Delete"
                      url="/api/admin/users"
                      body={{ userId: u.id, action: 'delete' }}
                      confirm={`${u.email} 계정을 완전히 삭제할까요? 되돌릴 수 없습니다.`}
                      danger
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
