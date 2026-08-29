'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Perk } from '@/lib/types';

export interface EventItem {
  id: number;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  organizer: string | null;
  perks: Perk[];
  isFree: boolean;
  category: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  source: string;
  viewCount: number;
}

/** UI 필터/뱃지는 4종으로 단순화 — swag/prize/free_stuff는 Goodies로 묶음 */
type PerkGroup = 'free_food' | 'drinks' | 'tshirt' | 'goodies';

const PERK_GROUP_OF: Record<Perk, PerkGroup> = {
  free_food: 'free_food',
  drinks: 'drinks',
  tshirt: 'tshirt',
  swag: 'goodies',
  prize: 'goodies',
  free_stuff: 'goodies',
};

const PERK_GROUP_LABELS: Record<PerkGroup, string> = {
  free_food: '🍕 Free Food',
  drinks: '🧋 Drinks',
  tshirt: '👕 T-shirt',
  goodies: '🎁 Goodies',
};

const CATEGORY_LABELS: Record<Category, string> = {
  campus: '🏛️ Campus',
  club: '🎪 Clubs',
  academic: '📚 Academic',
  sports: '🏈 Sports',
};

/** null = 전체 (선택 해제 상태가 곧 All) */
type WhenFilter = 'today' | 'tomorrow' | 'range' | null;

const PAGE_SIZE = 25;

const TZ = 'America/New_York';

/** ET 기준 날짜 키 (YYYY-MM-DD) */
function etDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

/** "YYYY-MM-DD" → "Aug 29" */
function shortDate(key: string): string {
  return new Date(key + 'T12:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function chipClass(active: boolean): string {
  return `shrink-0 whitespace-nowrap rounded-full border px-3 py-0.5 text-sm transition-colors ${
    active
      ? 'border-red-700 bg-red-700 text-white'
      : 'border-neutral-300 bg-white text-neutral-700 hover:border-red-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200'
  }`;
}

/** 좁은 화면에서는 줄바꿈 대신 가로 스크롤 (스크롤바 숨김) */
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </span>
      {children}
    </div>
  );
}

export function EventList({ events }: { events: EventItem[] }) {
  const [perkFilter, setPerkFilter] = useState<PerkGroup | null>(null);
  const [whenFilter, setWhenFilter] = useState<WhenFilter>(null);
  const [catFilter, setCatFilter] = useState<Category | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const totalRef = useRef(0);
  const todayKey = etDateKey(new Date());
  const tomorrowKey = etDateKey(new Date(Date.now() + 86400_000));
  const [rangeFrom, setRangeFrom] = useState(todayKey);
  const [rangeTo, setRangeTo] = useState(
    etDateKey(new Date(Date.now() + 7 * 86400_000)),
  );

  const filtered = useMemo(() => {
    let list = events;
    if (perkFilter) {
      list = list.filter((e) => e.perks.some((p) => PERK_GROUP_OF[p] === perkFilter));
    }
    if (whenFilter) {
      list = list.filter((e) => {
        const key = etDateKey(new Date(e.startsAt));
        if (whenFilter === 'today') return key === todayKey;
        if (whenFilter === 'tomorrow') return key === tomorrowKey;
        // range: YYYY-MM-DD 문자열은 사전순 비교가 곧 날짜 비교
        return key >= rangeFrom && key <= rangeTo;
      });
    }
    if (catFilter) list = list.filter((e) => e.category === catFilter);
    return list;
  }, [events, perkFilter, whenFilter, catFilter, todayKey, tomorrowKey, rangeFrom, rangeTo]);

  // 필터가 바뀌면 무한스크롤 처음부터
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [perkFilter, whenFilter, catFilter, rangeFrom, rangeTo]);

  // 무한 스크롤: 바닥 근처에 오면 다음 페이지 렌더
  totalRef.current = filtered.length;
  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 600;
      if (nearBottom) {
        setVisibleCount((c) => (c < totalRef.current ? c + PAGE_SIZE : c));
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const visible = filtered.slice(0, visibleCount);

  const countView = (id: number) => {
    // fire-and-forget 조회수 집계
    fetch(`/api/events/${id}/view`, { method: 'POST' }).catch(() => {});
  };

  let lastDay = '';

  return (
    <div>
      <div className="mb-4 space-y-2 rounded-xl bg-neutral-100 px-3 py-2.5 dark:bg-neutral-900">
        <FilterRow label="Freebies">
          {(Object.keys(PERK_GROUP_LABELS) as PerkGroup[]).map((p) => (
            <button
              key={p}
              onClick={() => setPerkFilter(perkFilter === p ? null : p)}
              className={chipClass(perkFilter === p)}
            >
              {PERK_GROUP_LABELS[p]}
            </button>
          ))}
        </FilterRow>
        <FilterRow label="When">
          <button
            onClick={() => setWhenFilter(whenFilter === 'today' ? null : 'today')}
            className={chipClass(whenFilter === 'today')}
          >
            Today ({shortDate(todayKey)})
          </button>
          <button
            onClick={() => setWhenFilter(whenFilter === 'tomorrow' ? null : 'tomorrow')}
            className={chipClass(whenFilter === 'tomorrow')}
          >
            Tomorrow ({shortDate(tomorrowKey)})
          </button>
          <button
            onClick={() => setWhenFilter(whenFilter === 'range' ? null : 'range')}
            className={chipClass(whenFilter === 'range')}
          >
            📅 Dates
          </button>
        </FilterRow>
        {whenFilter === 'range' && (
          <div className="flex items-center gap-1 pl-[5.5rem] text-sm">
            <input
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-0.5 dark:border-neutral-600 dark:bg-neutral-800"
            />
            <span className="text-neutral-400">–</span>
            <input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-0.5 dark:border-neutral-600 dark:bg-neutral-800"
            />
          </div>
        )}
        <FilterRow label="Type">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(catFilter === c ? null : c)}
              className={chipClass(catFilter === c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </FilterRow>
        <p className="text-right text-[11px] leading-none text-neutral-400">
          {filtered.length} events
        </p>
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-neutral-400">
          No events match. Try clearing filters.
        </p>
      )}

      <ul className="space-y-3">
        {visible.map((e) => {
          const day = dayKey(e.startsAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const badgeGroups = [...new Set(e.perks.map((p) => PERK_GROUP_OF[p]))];
          return (
            <li key={e.id}>
              {showDay && (
                <h2 className="mb-2 mt-6 border-b border-neutral-200 pb-1 text-sm font-semibold uppercase tracking-wide text-red-700 first:mt-0 dark:border-neutral-800 dark:text-red-400">
                  {day}
                </h2>
              )}
              <a
                href={e.sourceUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                onClick={() => countView(e.id)}
                className="block rounded-lg border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600"
              >
                <div className="flex gap-3">
                  {e.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{e.title}</h3>
                      {badgeGroups.length > 0 ? (
                        badgeGroups.map((g) => (
                          <span
                            key={g}
                            className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
                          >
                            {PERK_GROUP_LABELS[g]}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                          No freebies
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-neutral-500">
                      {formatWhen(e.startsAt)}
                      {e.locationName ? ` · ${e.locationName}` : ''}
                      {e.organizer ? ` · ${e.organizer}` : ''}
                    </p>
                    {e.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                        {e.summary}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
      {visible.length < filtered.length && (
        <p className="py-4 text-center text-xs text-neutral-400">Loading more…</p>
      )}
    </div>
  );
}
