import { count, desc, eq, isNotNull, max } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { AdminAction } from '../AdminAction';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [
    [{ users }],
    [{ events }],
    [{ likes }],
    [{ comments }],
    [{ hiddenComments }],
    [{ lastRun }],
  ] = await Promise.all([
    db.select({ users: count() }).from(schema.authUsers),
    db.select({ events: count() }).from(schema.events),
    db.select({ likes: count() }).from(schema.likes),
    db.select({ comments: count() }).from(schema.comments),
    db
      .select({ hiddenComments: count() })
      .from(schema.comments)
      .where(isNotNull(schema.comments.hiddenAt)),
    db.select({ lastRun: max(schema.rawEvents.runAt) }).from(schema.rawEvents),
  ]);

  const sourceCounts = lastRun
    ? await db
        .select({ source: schema.rawEvents.source, n: count() })
        .from(schema.rawEvents)
        .where(eq(schema.rawEvents.runAt, lastRun))
        .groupBy(schema.rawEvents.source)
        .orderBy(desc(count()))
    : [];

  const stats = [
    { label: 'Users', value: users },
    { label: 'Upcoming events', value: events },
    { label: 'Likes', value: likes },
    { label: 'Comments', value: comments },
    { label: 'Hidden (reported)', value: hiddenComments },
  ];

  return (
    <div>
      <h1 className="font-display text-xl font-bold">Dashboard</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-900"
          >
            <p className="text-xs text-stone-400">{s.label}</p>
            <p className="font-display text-2xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="font-display mt-8 text-lg font-bold">Ingest</h2>
      <div className="mt-2 rounded-lg border border-stone-200 bg-white p-4 text-sm dark:border-stone-700 dark:bg-stone-900">
        <p>
          Last run:{' '}
          <span className="font-medium">
            {lastRun
              ? new Date(lastRun).toLocaleString('en-US', {
                  timeZone: 'America/New_York',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }) + ' ET'
              : 'never'}
          </span>
        </p>
        {sourceCounts.length > 0 && (
          <p className="mt-1 text-stone-500">
            {sourceCounts.map((s) => `${s.source} ${s.n}`).join(' · ')}
          </p>
        )}
        <div className="mt-3">
          <AdminAction
            label="Run ingest now"
            url="/api/admin/ingest"
            confirm="수집 파이프라인을 지금 실행할까요? (LLM 호출 포함, 수 분 소요)"
          />
        </div>
      </div>
    </div>
  );
}
