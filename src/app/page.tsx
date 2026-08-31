import { asc, eq, gte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getAuthedUser, supabaseConfigured } from '@/lib/supabase/server';
import { AuthButton } from './AuthButton';
import { EventList } from './EventList';
import { FreshnessBanner } from './FreshnessBanner';
import { GuideButton } from './GuideButton';

export const dynamic = 'force-dynamic';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  domain: 'Only @ncsu.edu accounts are allowed. Please sign in with your NC State Google account.',
  denied: 'Sign-in was not completed. Only @ncsu.edu accounts are allowed.',
  missing_code: 'Sign-in was not completed. Please try again.',
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const now = new Date().toISOString();
  const [rows, user, params] = await Promise.all([
    db
      .select()
      .from(schema.events)
      .where(gte(schema.events.startsAt, now))
      .orderBy(asc(schema.events.startsAt)),
    getAuthedUser(),
    searchParams,
  ]);

  const favoriteIds = user
    ? (
        await db
          .select({ eventId: schema.favorites.eventId })
          .from(schema.favorites)
          .where(eq(schema.favorites.userId, user.id))
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
  }));

  return (
    <>
      <header className="relative bg-[#a30404]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/banner.png"
          alt="Hunter at Hunt — Free food hunter at NC State"
          className="mx-auto block h-auto w-full max-w-3xl"
        />
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {supabaseConfigured && <AuthButton userEmail={user?.email ?? null} />}
          <GuideButton />
        </div>
      </header>
      <FreshnessBanner />
      <main className="mx-auto max-w-3xl px-4 py-6">
        {authError && (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            {authError}
          </p>
        )}
        <EventList
          events={events}
          authEnabled={supabaseConfigured}
          userSignedIn={!!user}
          initialFavorites={favoriteIds}
        />
      </main>
    </>
  );
}
