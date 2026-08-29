import { asc, gte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { EventList } from './EventList';
import { FreshnessBanner } from './FreshnessBanner';
import { GuideButton } from './GuideButton';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const now = new Date().toISOString();
  const rows = await db
    .select()
    .from(schema.events)
    .where(gte(schema.events.startsAt, now))
    .orderBy(asc(schema.events.startsAt));

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
        <GuideButton />
      </header>
      <FreshnessBanner />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <EventList events={events} />
      </main>
    </>
  );
}
