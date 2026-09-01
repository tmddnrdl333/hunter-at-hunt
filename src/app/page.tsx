import { asc, count, eq, gt, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getAuthedUser, supabaseConfigured } from '@/lib/supabase/server';
import { AuthErrorModal } from './AuthErrorModal';
import { AuthToast } from './AuthToast';
import { EventList } from './EventList';
import { FloatingDock } from './FloatingDock';
import { FreshnessBanner } from './FreshnessBanner';

export const dynamic = 'force-dynamic';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  domain: 'Only @ncsu.edu accounts are allowed. Please sign in with your NC State Google account.',
  denied: 'Sign-in was not completed. Only @ncsu.edu accounts are allowed.',
  missing_code: 'Sign-in was not completed. Please try again.',
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string; auth?: string }>;
}) {
  const [rows, likeRows, user, params] = await Promise.all([
    // 종료 시각까지 유지 (종료 시각이 없으면 시작 +2시간까지)
    db
      .select()
      .from(schema.events)
      .where(
        sql`coalesce(${schema.events.endsAt}::timestamptz, ${schema.events.startsAt}::timestamptz + interval '2 hours') >= now()`,
      )
      .orderBy(asc(schema.events.startsAt)),
    db
      .select({ eventId: schema.likes.eventId, likeCount: count() })
      .from(schema.likes)
      .groupBy(schema.likes.eventId),
    getAuthedUser(),
    searchParams,
  ]);

  const likeCountMap = new Map(likeRows.map((r) => [r.eventId, r.likeCount]));

  const myLikes = user
    ? (
        await db
          .select({ eventId: schema.likes.eventId })
          .from(schema.likes)
          .where(eq(schema.likes.userId, user.id))
      ).map((r) => r.eventId)
    : [];

  const authError = params.auth_error
    ? (AUTH_ERROR_MESSAGES[params.auth_error] ?? AUTH_ERROR_MESSAGES.denied)
    : null;

  // 🔥 인기: 최근 7일간 받은 좋아요가 5개 이상인 것 중 상위 3개
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const weeklyLikes = await db
    .select({ eventId: schema.likes.eventId, weekly: count() })
    .from(schema.likes)
    .where(gt(schema.likes.createdAt, weekAgo))
    .groupBy(schema.likes.eventId);
  const trendingIds = new Set(
    weeklyLikes
      .filter((w) => w.weekly >= 5)
      .sort((a, b) => b.weekly - a.weekly)
      .slice(0, 3)
      .map((w) => w.eventId),
  );

  const events = rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary ?? r.descriptionText?.slice(0, 160) ?? '',
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    locationName: r.locationName,
    organizer: r.organizer,
    perks: r.perks,
    isFree: r.isFree,
    category: r.category,
    imageUrl: r.imageUrl,
    sourceUrl: r.sourceUrl,
    source: r.source,
    viewCount: r.viewCount,
    likeCount: likeCountMap.get(r.id) ?? 0,
    trending: trendingIds.has(r.id),
  }));

  // 오늘의 하이라이트: perks 태그 집계 (LLM 추가 호출 없음 — ingest 때 붙인 태그를 세기만 함)
  const etKey = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const todayEt = etKey(new Date().toISOString());
  const todayEvents = events.filter((e) => etKey(e.startsAt) === todayEt);
  const todayFood = todayEvents.filter((e) => e.perks.includes('free_food')).length;
  const todayFreebies = todayEvents.filter((e) => e.perks.length > 0).length;
  let highlight: string | null = null;
  if (todayFood > 0) {
    const extra = todayFreebies - todayFood;
    highlight = `🍕 Free food at ${todayFood} event${todayFood > 1 ? 's' : ''} today${
      extra > 0 ? ` · ${extra} more freebie${extra > 1 ? 's' : ''}` : ''
    }`;
  } else if (todayFreebies > 0) {
    highlight = `🎁 Freebies at ${todayFreebies} event${todayFreebies > 1 ? 's' : ''} today`;
  } else {
    const nextFood = events.find((e) => e.perks.includes('free_food'));
    if (nextFood) {
      const day = new Date(nextFood.startsAt).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      highlight = `🍕 Next free food: ${day} — ${nextFood.title}`;
    }
  }

  return (
    <>
      {/* 양옆 밴드는 배너의 최빈색(배경 원단 레드 #b80000) 단색 */}
      <header className="bg-[#b80000]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/banner.png"
          alt="Hunter at Hunt — Free food hunter at NC State"
          className="mx-auto block h-auto w-full max-w-3xl"
        />
      </header>
      <FreshnessBanner />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        {authError && <AuthErrorModal message={authError} />}
        {highlight && (
          <p className="mb-3 rounded-lg bg-red-800/10 px-3 py-2 text-sm font-medium text-red-900 dark:bg-red-400/10 dark:text-red-200">
            {highlight}
          </p>
        )}
        {(params.auth === 'signedin' || params.auth === 'signedout') && (
          <AuthToast kind={params.auth} email={user?.email} />
        )}
        <EventList
          events={events}
          authEnabled={supabaseConfigured}
          userSignedIn={!!user}
          initialLikes={myLikes}
        />
      </main>
      <FloatingDock
        authEnabled={supabaseConfigured}
        userEmail={user?.email ?? null}
      />
    </>
  );
}
