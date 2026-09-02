import type { NormalizedEvent, SourceAdapter } from '../types';
import { mapEngageBenefits } from '../perks';
import { fetchJson, htmlToText, toCoord, toIso } from '../util';

const BASE = 'https://getinvolved.ncsu.edu/api/discovery/event/search';
const IMAGE_CDN = 'https://se-images.campuslabs.com/clink/images/';

interface EngageEvent {
  id: string;
  name: string;
  description: string;
  location: string;
  startsOn: string; // 진짜 UTC (+00:00)
  endsOn: string;
  organizationName: string | null;
  benefitNames: string[];
  latitude: string | null;
  longitude: string | null;
  imagePath: string | null;
  visibility: string;
}

export const engage: SourceAdapter = {
  name: 'engage',
  async fetchEvents({ days }) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 86400_000);
    const out: NormalizedEvent[] = [];
    const take = 100;
    let skip = 0;
    for (;;) {
      const params = new URLSearchParams({
        endsAfter: now.toISOString(),
        startsBefore: until.toISOString(),
        status: 'Approved',
        orderByField: 'endsOn',
        orderByDirection: 'ascending',
        take: String(take),
        skip: String(skip),
      });
      const data = await fetchJson<{ value: EngageEvent[] }>(`${BASE}?${params}`);
      for (const e of data.value) {
        if (e.visibility !== 'Public') continue;
        out.push({
          source: 'engage',
          sourceId: e.id,
          title: e.name,
          descriptionText: htmlToText(e.description),
          startsAt: toIso(e.startsOn),
          endsAt: e.endsOn ? toIso(e.endsOn) : null,
          locationName: e.location || null,
          address: null,
          lat: toCoord(e.latitude),
          lng: toCoord(e.longitude),
          organizer: e.organizationName,
          perks: mapEngageBenefits(e.benefitNames ?? []),
          isFree: (e.benefitNames ?? []).length > 0,
          category: 'club',
          imageUrl: e.imagePath ? IMAGE_CDN + e.imagePath : null,
          sourceUrl: `https://getinvolved.ncsu.edu/event/${e.id}`,
          raw: e,
        });
      }
      if (data.value.length < take) break;
      skip += take;
    }
    return out;
  },
};
