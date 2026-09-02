import type { NormalizedEvent, SourceAdapter } from '../types';
import { fetchJson, htmlToText, toCoord, toIso } from '../util';

const BASE = 'https://calendar.ncsu.edu/api/2/events';

interface LocalistPage {
  events: { event: LocalistEvent }[];
  page: { current: number; size: number; total: number };
}

interface LocalistEvent {
  id: number;
  title: string;
  status: string;
  location_name: string;
  room_number: string;
  description_text: string;
  free: boolean;
  photo_url: string | null;
  localist_url: string;
  geo?: { latitude?: string; longitude?: string; street?: string; city?: string };
  address?: string;
  groups?: { name?: string; id?: number }[];
  event_instances?: { event_instance: { id: number; start: string; end: string | null } }[];
}

export const localist: SourceAdapter = {
  name: 'localist',
  async fetchEvents({ days }) {
    const out: NormalizedEvent[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const data = await fetchJson<LocalistPage>(
        `${BASE}?days=${days}&pp=100&page=${page}`,
      );
      totalPages = data.page.total;
      for (const { event: e } of data.events) {
        if (e.status !== 'live') continue;
        for (const { event_instance: inst } of e.event_instances ?? []) {
          out.push({
            source: 'localist',
            sourceId: `${e.id}:${inst.id}`,
            title: e.title,
            descriptionText: htmlToText(e.description_text),
            startsAt: toIso(inst.start),
            endsAt: inst.end ? toIso(inst.end) : null,
            locationName:
              [e.location_name, e.room_number].filter(Boolean).join(' ') || null,
            address: e.geo?.street
              ? `${e.geo.street}${e.geo.city ? ', ' + e.geo.city : ''}`
              : e.address || null,
            lat: toCoord(e.geo?.latitude),
            lng: toCoord(e.geo?.longitude),
            organizer: e.groups?.[0]?.name ?? null,
            perks: [],
            isFree: e.free,
            // 다이닝/캠퍼스 상점 주최는 Dining 카테고리로 분류
            category: /dining|campus enterprises/i.test(e.groups?.[0]?.name ?? '')
              ? 'dining'
              : 'campus',
            imageUrl: e.photo_url,
            sourceUrl: e.localist_url,
            raw: e,
          });
        }
      }
      page++;
    } while (page <= totalPages);
    return out;
  },
};
