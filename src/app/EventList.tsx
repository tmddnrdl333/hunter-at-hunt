'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Perk } from '@/lib/types';
import { SignInModal } from './SignInModal';

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** 날짜 그룹 헤더: "Sat · Aug 29" */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
  const date = d.toLocaleDateString('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
  });
  return `${weekday} · ${date}`;
}

function chipClass(active: boolean): string {
  return `shrink-0 whitespace-nowrap rounded-lg border px-3 py-0.5 text-sm transition-all active:scale-95 ${
    active
      ? 'border-red-800 bg-red-800 text-white shadow-sm'
      : 'border-stone-300 bg-white/70 text-stone-700 hover:border-red-700 hover:text-red-800 dark:border-stone-600 dark:bg-stone-800/70 dark:text-stone-200 dark:hover:text-red-300'
  }`;
}

/** 좁은 화면에서는 줄바꿈 대신 가로 스크롤 (스크롤바 숨김) */
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </span>
      {children}
    </div>
  );
}

export function EventList({
  events,
  authEnabled,
  userSignedIn,
  initialFavorites,
}: {
  events: EventItem[];
  /** Supabase Auth 설정 여부 — false면 즐겨찾기 UI를 숨김 (데모 모드) */
  authEnabled: boolean;
  userSignedIn: boolean;
  initialFavorites: number[];
}) {
  const [perkFilter, setPerkFilter] = useState<PerkGroup | null>(null);
  const [whenFilter, setWhenFilter] = useState<WhenFilter>(null);
  const [catFilter, setCatFilter] = useState<Category | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(
    () => new Set(initialFavorites),
  );
  const [signInOpen, setSignInOpen] = useState(false);
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
    if (savedOnly) list = list.filter((e) => favorites.has(e.id));
    return list;
  }, [events, perkFilter, whenFilter, catFilter, savedOnly, favorites, todayKey, tomorrowKey, rangeFrom, rangeTo]);

  // 필터가 바뀌면 무한스크롤 처음부터
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [perkFilter, whenFilter, catFilter, savedOnly, rangeFrom, rangeTo]);

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

  const toggleFavorite = (id: number) => {
    if (!userSignedIn) {
      // 비로그인 상태에서 별을 누르면 로그인 유도 (로그인 후 이 페이지로 복귀)
      setSignInOpen(true);
      return;
    }
    // 낙관적 업데이트 후 서버 동기화, 실패 시 롤백
    const wasSaved = favorites.has(id);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id);
      else next.add(id);
      return next;
    });
    fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: id }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
      })
      .catch(() => {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(id);
          else next.delete(id);
          return next;
        });
      });
  };

  let lastDay = '';

  return (
    <div>
      {/* 스크롤해도 상단에 붙는 필터바 */}
      <div className="sticky top-0 z-40 -mx-4 mb-2 space-y-2 border-b border-stone-200 bg-background/90 px-4 py-2.5 backdrop-blur dark:border-stone-800">
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
              className="rounded-md border border-stone-300 bg-white/70 px-2 py-0.5 tabular-nums dark:border-stone-600 dark:bg-stone-800"
            />
            <span className="text-stone-400">–</span>
            <input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              className="rounded-md border border-stone-300 bg-white/70 px-2 py-0.5 tabular-nums dark:border-stone-600 dark:bg-stone-800"
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
          {authEnabled && (
            <button
              onClick={() => {
                if (!userSignedIn) {
                  setSignInOpen(true);
                  return;
                }
                setSavedOnly(!savedOnly);
              }}
              className={chipClass(savedOnly)}
            >
              ⭐ Saved
            </button>
          )}
          <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-stone-400">
            {filtered.length} events
          </span>
        </FilterRow>
      </div>
      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        message="Sign in to save events you don't want to miss."
      />

      {filtered.length === 0 && (
        <div className="py-12 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/not-found.png"
            alt=""
            className="mx-auto h-44 w-44 opacity-90"
          />
          <p className="mt-2 text-stone-500 dark:text-stone-400">
            Nothing found. The wolf sniffed everywhere —
            <br />
            try clearing a filter.
          </p>
        </div>
      )}

      <ul>
        {visible.map((e) => {
          const day = dayKey(e.startsAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const badgeGroups = [...new Set(e.perks.map((p) => PERK_GROUP_OF[p]))];
          const hasFreebies = badgeGroups.length > 0;
          return (
            <li key={e.id}>
              {showDay && (
                <h2 className="font-display mt-8 flex items-baseline gap-2 pb-2 text-2xl font-bold tracking-tight text-stone-900 first:mt-2 dark:text-stone-100">
                  <span className="text-red-800 dark:text-red-400">
                    {day.split(' · ')[0]}
                  </span>
                  <span>{day.split(' · ')[1]}</span>
                </h2>
              )}
              <a
                href={e.sourceUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                onClick={() => countView(e.id)}
                className={
                  hasFreebies
                    ? 'group mb-2 flex gap-3 rounded-xl border-l-4 border-red-800 bg-white p-3.5 shadow-sm transition-transform hover:translate-x-0.5 dark:bg-stone-800/80'
                    : 'group flex gap-3 border-b border-stone-200/80 px-1 py-3 transition-transform hover:translate-x-0.5 dark:border-stone-800'
                }
              >
                <span className="w-[4.5rem] shrink-0 pt-0.5 font-mono text-xs tabular-nums text-stone-500">
                  {formatTime(e.startsAt)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-semibold leading-snug group-hover:underline group-hover:decoration-red-800/50 group-hover:underline-offset-2">
                      {e.title}
                    </h3>
                    {badgeGroups.map((g) => (
                      <span
                        key={g}
                        className="rounded-md bg-red-800/10 px-1.5 py-0.5 text-xs font-medium text-red-900 dark:bg-red-400/15 dark:text-red-300"
                      >
                        {PERK_GROUP_LABELS[g]}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
                    {e.locationName ?? 'Location TBA'}
                    {e.organizer ? ` · ${e.organizer}` : ''}
                  </p>
                  {e.summary && (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                      {e.summary}
                    </p>
                  )}
                </div>
                {e.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}
                {authEnabled && (
                  <button
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      toggleFavorite(e.id);
                    }}
                    aria-label={favorites.has(e.id) ? 'Unsave event' : 'Save event'}
                    className={`shrink-0 self-start text-lg leading-none transition-transform active:scale-90 ${
                      favorites.has(e.id)
                        ? 'opacity-100'
                        : 'opacity-25 grayscale hover:opacity-60 hover:grayscale-0'
                    }`}
                  >
                    ⭐
                  </button>
                )}
              </a>
            </li>
          );
        })}
      </ul>
      {visible.length < filtered.length && (
        <p className="py-4 text-center text-xs text-stone-400">Loading more…</p>
      )}
      {filtered.length > 0 && visible.length >= filtered.length && (
        <div className="py-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wolf-footprint.png"
            alt=""
            className="mx-auto h-10 w-auto opacity-50 dark:opacity-40 dark:grayscale dark:invert"
          />
          <p className="mt-3 text-xs text-stone-400">
            End of the trail — check back tomorrow 🐺
          </p>
        </div>
      )}
    </div>
  );
}
