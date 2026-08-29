import type { NormalizedEvent, SourceAdapter } from '../types';
import { easternToUtc, fetchJson } from '../util';

const BASE = 'https://gopack.com/api/v2/Calendar/events';

interface SidearmDay {
  date: string;
  events: SidearmEvent[];
}

interface SidearmEvent {
  id: number;
  date: string; // 오프셋 없는 동부시간
  time: string;
  location: string;
  locationIndicator: 'H' | 'A' | 'N';
  atVs: string;
  status: string;
  sport?: { title?: string };
  opponent?: { title?: string };
  facility?: { title?: string };
}

export const sidearm: SourceAdapter = {
  name: 'sidearm',
  async fetchEvents({ days }) {
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      dates.push(new Date(Date.now() + i * 86400_000).toISOString().slice(0, 10));
    }
    const seen = new Set<number>();
    const out: NormalizedEvent[] = [];
    // 하루 단위 API라 순차 호출 (일 배치라 30회 정도는 부담 없음)
    for (const d of dates) {
      let dayData: SidearmDay[];
      try {
        dayData = await fetchJson<SidearmDay[]>(`${BASE}?date=${d}`);
      } catch {
        continue;
      }
      for (const day of dayData) {
        for (const e of day.events) {
          // 홈경기만, 중복 제거 (API가 인접 날짜를 겹쳐서 반환할 수 있음)
          if (e.locationIndicator !== 'H' || seen.has(e.id)) continue;
          seen.add(e.id);
          const sport = e.sport?.title ?? 'NC State';
          const opponent = e.opponent?.title ?? 'TBA';
          out.push({
            source: 'sidearm',
            sourceId: String(e.id),
            title: `${sport} vs ${opponent}`,
            descriptionText: `NC State ${sport} home game vs ${opponent}${
              e.facility?.title ? ` at ${e.facility.title}` : ''
            }. ${e.time}`,
            startsAt: easternToUtc(e.date).toISOString(),
            endsAt: null,
            locationName: e.facility?.title ?? e.location,
            address: null,
            lat: null,
            lng: null,
            organizer: 'NC State Athletics',
            perks: [],
            isFree: false,
            category: 'sports',
            imageUrl: null,
            sourceUrl: 'https://gopack.com/calendar',
            raw: e,
          });
        }
      }
    }
    return out;
  },
};
