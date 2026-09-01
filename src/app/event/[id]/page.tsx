import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { googleCalendarUrl } from '@/lib/calendar';
import { db, schema } from '@/lib/db';
import { getAuthedUser, supabaseConfigured } from '@/lib/supabase/server';
import type { Perk } from '@/lib/types';
import { FloatingDock } from '@/app/FloatingDock';
import { AttendanceWidget } from './AttendanceWidget';
import { Comments, type CommentView } from './Comments';

export const dynamic = 'force-dynamic';

const TZ = 'America/New_York';

const PERK_LABELS: Record<Perk, string> = {
  free_food: '🍕 Free Food',
  drinks: '🧋 Drinks',
  tshirt: '👕 T-shirt',
  swag: '🎁 Swag',
  prize: '🏆 Prize',
  free_stuff: '✨ Free Stuff',
};

const MAX_INT4 = 2147483647;

// React cache: generateMetadata와 페이지 본문이 같은 요청에서 중복 조회하지 않게
const getEvent = cache(async (idParam: string) => {
  // 정규 형식(십진 숫자만)과 int4 범위를 검증 — /event/1e3, 초과값 등은 404로
  if (!/^\d{1,10}$/.test(idParam)) return null;
  const id = Number(idParam);
  if (id <= 0 || id > MAX_INT4) return null;
  try {
    const [event] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, id));
    return event ?? null;
  } catch (err) {
    console.error('[event page] query error:', err);
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const event = await getEvent((await params).id);
  if (!event) return { title: 'Event not found — Hunter at Hunt' };
  return {
    title: `${event.title} — Hunter at Hunt`,
    description: (event.summary || event.descriptionText || 'NC State campus event').slice(0, 160),
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [event, user] = await Promise.all([
    getEvent((await params).id),
    getAuthedUser(),
  ]);
  if (!event) notFound();

  const [[{ likeCount }], commentRows, commentLikeRows, myCommentLikeRows, attAgg, myAttRows] =
    await Promise.all([
      db
        .select({ likeCount: count() })
        .from(schema.likes)
        .where(eq(schema.likes.eventId, event.id)),
      // 숨김 처리된 댓글은 제외
      db
        .select({
          id: schema.comments.id,
          parentId: schema.comments.parentId,
          body: schema.comments.body,
          createdAt: schema.comments.createdAt,
          userId: schema.comments.userId,
          deletedAt: schema.comments.deletedAt,
          email: schema.authUsers.email,
        })
        .from(schema.comments)
        .leftJoin(schema.authUsers, eq(schema.comments.userId, schema.authUsers.id))
        .where(and(eq(schema.comments.eventId, event.id), isNull(schema.comments.hiddenAt)))
        .orderBy(asc(schema.comments.createdAt))
        .limit(200),
      db
        .select({ commentId: schema.commentLikes.commentId, n: count() })
        .from(schema.commentLikes)
        .innerJoin(schema.comments, eq(schema.commentLikes.commentId, schema.comments.id))
        .where(eq(schema.comments.eventId, event.id))
        .groupBy(schema.commentLikes.commentId),
      user
        ? db
            .select({ commentId: schema.commentLikes.commentId })
            .from(schema.commentLikes)
            .innerJoin(schema.comments, eq(schema.commentLikes.commentId, schema.comments.id))
            .where(
              and(
                eq(schema.comments.eventId, event.id),
                eq(schema.commentLikes.userId, user.id),
              ),
            )
        : Promise.resolve([]),
      // Field Report 집계는 SQL에서 (행 전체를 앱으로 끌어오지 않음)
      db.execute(sql`
        select count(*)::int as went,
          mode() within group (order by crowd) filter (where crowd is not null) as top_crowd,
          min(ran_out_at) filter (where food_ran_out and ran_out_at is not null) as ran_out_at,
          coalesce(bool_or(food_ran_out), false) as any_ran_out,
          coalesce(bool_or(not food_ran_out), false) as any_not_ran_out
        from attendance where event_id = ${event.id}
      `),
      user
        ? db
            .select({ userId: schema.attendance.userId })
            .from(schema.attendance)
            .where(
              and(
                eq(schema.attendance.eventId, event.id),
                eq(schema.attendance.userId, user.id),
              ),
            )
        : Promise.resolve([]),
      // 공유 링크 유입도 조회수에 집계 (카드 클릭과 동일 지표)
      db
        .update(schema.events)
        .set({ viewCount: sql`${schema.events.viewCount} + 1` })
        .where(eq(schema.events.id, event.id)),
    ]);

  const likeCountByComment = new Map(commentLikeRows.map((r) => [r.commentId, r.n]));
  const myLikedComments = new Set(myCommentLikeRows.map((r) => r.commentId));
  // 부모가 숨김 처리된 답글은 렌더 불가 상태이므로 목록·카운트에서 함께 제외
  const visibleIds = new Set(commentRows.map((c) => c.id));
  const comments: CommentView[] = commentRows
    .filter((c) => c.parentId === null || visibleIds.has(c.parentId))
    .map((c) => ({
      id: c.id,
      parentId: c.parentId,
      body: c.deletedAt ? '' : c.body,
      createdAt: c.createdAt,
      author: c.email?.split('@')[0] ?? 'hunter',
      likeCount: likeCountByComment.get(c.id) ?? 0,
      likedByMe: myLikedComments.has(c.id),
      isMine: user?.id === c.userId,
      deleted: !!c.deletedAt,
    }));

  // Field Report — 데이터가 하나라도 있을 때만 표시. 형식 밖 값은 조용히 생략
  const fmtClock = (t: string): string | null => {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
    if (!m) return null;
    const h = Number(m[1]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${((h + 11) % 12) + 1}:${m[2]} ${ampm}`;
  };
  const CROWD_LABELS: Record<string, string> = {
    quiet: '😌 quiet',
    moderate: '🙂 moderate',
    packed: '😵 packed',
  };
  const agg = (attAgg as unknown as Array<Record<string, unknown>>)[0] ?? {};
  const went = Number(agg.went ?? 0);
  let fieldReport: string | null = null;
  if (went > 0) {
    const parts = [`🐺 ${went} hunter${went > 1 ? 's' : ''} went`];
    const crowdLabel = CROWD_LABELS[String(agg.top_crowd ?? '')];
    if (crowdLabel) parts.push(crowdLabel);
    const ranOutClock = typeof agg.ran_out_at === 'string' ? fmtClock(agg.ran_out_at) : null;
    if (ranOutClock) {
      parts.push(`🍕 food ran out ~${ranOutClock}`);
    } else if (agg.any_ran_out === true) {
      parts.push('🍕 food ran out');
    } else if (agg.any_not_ran_out === true) {
      parts.push('🍕 food was still available');
    }
    fieldReport = parts.join(' · ');
  }

  const when = new Date(event.startsAt).toLocaleString('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  // 자정을 넘기는 이벤트는 종료 쪽에도 날짜를 표기
  const etDay = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
  const until = event.endsAt
    ? new Date(event.endsAt).toLocaleString(
        'en-US',
        etDay(event.endsAt) === etDay(event.startsAt)
          ? { timeZone: TZ, hour: 'numeric', minute: '2-digit' }
          : {
              timeZone: TZ,
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            },
      )
    : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/"
        className="text-sm text-stone-400 hover:text-red-800 dark:hover:text-red-300"
      >
        ← All events
      </Link>

      <div className="mt-4 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold leading-tight">
            {event.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.perks.map((p) => (
              <span
                key={p}
                className="rounded-md bg-red-800/10 px-2 py-0.5 text-xs font-medium text-red-900 dark:bg-red-400/15 dark:text-red-300"
              >
                {PERK_LABELS[p]}
              </span>
            ))}
            {likeCount > 0 && (
              <span className="rounded-md bg-stone-200/70 px-2 py-0.5 text-xs font-medium text-stone-600 tabular-nums dark:bg-stone-800 dark:text-stone-300">
                👍 {likeCount}
              </span>
            )}
          </div>
        </div>
        {event.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.imageUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
        )}
      </div>

      <dl className="mt-5 space-y-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 font-semibold text-stone-400">When</dt>
          <dd>
            {when}
            {until ? ` – ${until}` : ''} <span className="text-stone-400">ET</span>
          </dd>
        </div>
        {event.locationName && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 font-semibold text-stone-400">Where</dt>
            <dd>{event.locationName}</dd>
          </div>
        )}
        {event.organizer && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 font-semibold text-stone-400">By</dt>
            <dd>{event.organizer}</dd>
          </div>
        )}
      </dl>

      {fieldReport && (
        <p className="mt-4 rounded-lg bg-red-800/10 px-3 py-2 text-sm font-medium text-red-900 dark:bg-red-400/10 dark:text-red-200">
          {fieldReport}
        </p>
      )}

      {(event.summary || event.descriptionText) && (
        <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {event.descriptionText || event.summary}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {event.sourceUrl && (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-red-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            View original event page →
          </a>
        )}
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-red-700 hover:text-red-800 dark:border-stone-600 dark:text-stone-200"
        >
          📅 Add to Google Calendar
        </a>
      </div>

      <Comments eventId={event.id} comments={comments} signedIn={!!user} />

      <AttendanceWidget
        eventId={event.id}
        signedIn={!!user}
        alreadyWent={myAttRows.length > 0}
        startsAt={event.startsAt}
      />
      <FloatingDock authEnabled={supabaseConfigured} userEmail={user?.email ?? null} />
    </main>
  );
}
