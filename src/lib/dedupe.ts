import type { NormalizedEvent, SourceName } from './types';
import { titleSimilarity } from './util';

/** 병합 시 어느 소스 레코드를 남길지 우선순위 (정보량 기준) */
const SOURCE_PRIORITY: Record<SourceName, number> = {
  localist: 0,
  engage: 1,
  wordpress: 2,
  sidearm: 3,
  foodtrucks: 4,
};

const SIMILARITY_THRESHOLD = 0.75;

/**
 * 크로스 소스(+ 소스 내) 중복 병합.
 * 규칙: 시작 시각이 정확히 같고 제목 유사도 > 0.75 → 같은 이벤트로 병합.
 * ("Interest Meeting" 같은 흔한 제목의 오병합을 막기 위해 시각 일치가 필수 조건)
 */
export function dedupe(all: NormalizedEvent[]): NormalizedEvent[] {
  const byStart = new Map<string, NormalizedEvent[]>();
  for (const e of all) {
    const bucket = byStart.get(e.startsAt) ?? [];
    bucket.push(e);
    byStart.set(e.startsAt, bucket);
  }

  const out: NormalizedEvent[] = [];
  for (const bucket of byStart.values()) {
    bucket.sort(
      (a, b) => SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source],
    );
    const kept: NormalizedEvent[] = [];
    for (const e of bucket) {
      const dup = kept.find(
        (k) => titleSimilarity(k.title, e.title) > SIMILARITY_THRESHOLD,
      );
      if (dup) {
        // 우선순위 높은 쪽(dup)을 남기고 빈 필드와 perks만 보강
        dup.perks = [...new Set([...dup.perks, ...e.perks])];
        dup.isFree = dup.isFree || e.isFree;
        dup.locationName ??= e.locationName;
        dup.address ??= e.address;
        dup.lat ??= e.lat;
        dup.lng ??= e.lng;
        dup.organizer ??= e.organizer;
        dup.imageUrl ??= e.imageUrl;
        if (e.descriptionText.length > dup.descriptionText.length) {
          dup.descriptionText = e.descriptionText;
        }
      } else {
        kept.push(e);
      }
    }
    out.push(...kept);
  }
  return out;
}
