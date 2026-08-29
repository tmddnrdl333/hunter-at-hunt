import type { NormalizedEvent, SourceAdapter } from '../types';
import { fetchJson, htmlToText } from '../util';

/** WP Events Calendar API가 열려 있는 것으로 확인된 학과 사이트. 404면 자동 스킵. */
const DEPT_SITES = [
  'csc.ncsu.edu',
  'ise.ncsu.edu',
  'chemistry.sciences.ncsu.edu',
];

interface WpEvent {
  id: number;
  title: string;
  description: string;
  excerpt: string;
  url: string;
  utc_start_date: string; // "YYYY-MM-DD HH:MM:SS"
  utc_end_date: string;
  image: { url?: string } | false;
  venue?: { venue?: string; address?: string; city?: string } | [];
  organizer?: { organizer?: string }[];
}

function wpUtcToIso(s: string): string {
  return new Date(s.replace(' ', 'T') + 'Z').toISOString();
}

export const wordpress: SourceAdapter = {
  name: 'wordpress',
  async fetchEvents({ days }) {
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
    const results = await Promise.allSettled(
      DEPT_SITES.map(async (site) => {
        const data = await fetchJson<{ events: WpEvent[] }>(
          `https://${site}/wp-json/tribe/events/v1/events?per_page=50&start_date=${start}&end_date=${end}`,
        );
        return data.events.map((e): NormalizedEvent => {
          const venue = Array.isArray(e.venue) ? undefined : e.venue;
          return {
            source: 'wordpress',
            sourceId: `${site}:${e.id}`,
            title: htmlToText(e.title),
            descriptionText: htmlToText(e.description || e.excerpt),
            startsAt: wpUtcToIso(e.utc_start_date),
            endsAt: e.utc_end_date ? wpUtcToIso(e.utc_end_date) : null,
            locationName: venue?.venue ?? null,
            address: venue?.address
              ? `${venue.address}${venue.city ? ', ' + venue.city : ''}`
              : null,
            lat: null,
            lng: null,
            organizer: e.organizer?.[0]?.organizer ?? site.split('.')[0].toUpperCase(),
            perks: [],
            isFree: false,
            category: 'academic',
            imageUrl: (e.image && e.image.url) || null,
            sourceUrl: e.url,
            raw: e,
          };
        });
      }),
    );
    const out: NormalizedEvent[] = [];
    for (const [i, r] of results.entries()) {
      if (r.status === 'fulfilled') out.push(...r.value);
      else console.warn(`  [wordpress] ${DEPT_SITES[i]} 실패: ${r.reason}`);
    }
    return out;
  },
};
