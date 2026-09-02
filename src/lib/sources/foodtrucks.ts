import type { NormalizedEvent, SourceAdapter } from '../types';
import { easternToUtc } from '../util';

/**
 * Centennial 캠퍼스 푸드트럭 — 평일 11:30–1:30, Venture Center Courtyard 고정 로테이션.
 * 실제 라인업은 StreetFoodFinder에 있지만 서버 접근이 봇 차단(403)이라,
 * 확정된 정규 일정을 자체 생성하고 그날의 트럭은 원문 링크로 연결한다.
 * (출처: dining.ncsu.edu/food-trucks — "A rotating schedule of food trucks
 *  are available weekdays in the Venture Center Courtyard.")
 */
const SCHEDULE_URL = 'https://streetfoodfinder.com/NCStateCentennial';
/** 1017 Main Campus Dr (Venture/Partners 단지) — Nominatim 지오코딩 */
const LAT = 35.77049;
const LNG = -78.67736;

export const foodtrucks: SourceAdapter = {
  name: 'foodtrucks',
  async fetchEvents({ days }) {
    const out: NormalizedEvent[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() + i * 86400_000);
      const dateKey = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      // DST 전환일에 24h 더하기가 같은 ET 날짜를 두 번 만들 수 있음 → 중복 방지
      if (seen.has(dateKey)) continue;
      seen.add(dateKey);
      const weekday = d.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
      });
      if (weekday === 'Sat' || weekday === 'Sun') continue;
      const endsAt = easternToUtc(`${dateKey}T13:30:00`);
      // 오늘치가 이미 끝난 시각이면 생성하지 않음 (넣자마자 purge되어 LLM만 낭비)
      if (endsAt.getTime() <= Date.now()) continue;
      out.push({
        source: 'foodtrucks',
        sourceId: `vcc:${dateKey}`,
        title: 'Food Trucks at Venture Center Courtyard',
        descriptionText:
          "A rotating lineup of local food trucks parks at the Venture Center Courtyard on Centennial Campus every weekday, 11:30 AM to 1:30 PM. Check today's lineup and menus on StreetFoodFinder.",
        startsAt: easternToUtc(`${dateKey}T11:30:00`).toISOString(),
        endsAt: endsAt.toISOString(),
        locationName: 'Venture Center Courtyard, Centennial Campus',
        address: '1017 Main Campus Dr, Raleigh',
        lat: LAT,
        lng: LNG,
        organizer: 'NC State Dining',
        perks: [],
        isFree: false,
        category: 'dining',
        imageUrl: null,
        sourceUrl: SCHEDULE_URL,
        raw: { generated: 'weekday food truck schedule' },
      });
    }
    return out;
  },
};
