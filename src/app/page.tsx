import { asc, count, eq, sql } from 'drizzle-orm';
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
  }));

  return (
    <>
      {/* 배너(중앙 max-w-3xl=48rem) 좌/우 가장자리 열의 실측 평균색을 양옆 밴드에 정확히 매칭 —
          그라데이션 정지점을 배너 경계(50%±24rem)에 두어 밴드 영역은 각각 단색이 된다 */}
      <header className="bg-[linear-gradient(to_right,#870101_calc(50%-24rem),#b80101_calc(50%+24rem))]">
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
