export const PERK_VALUES = [
  'free_food',
  'drinks',
  'tshirt',
  'swag',
  'prize',
  'free_stuff',
] as const;

export type Perk = (typeof PERK_VALUES)[number];

export type SourceName = 'localist' | 'engage' | 'wordpress' | 'sidearm' | 'foodtrucks';

export type Category = 'campus' | 'club' | 'academic' | 'sports' | 'dining';

/** 모든 소스 어댑터가 뱉는 공통 형식. DB events 테이블과 1:1 대응. */
export interface NormalizedEvent {
  source: SourceName;
  sourceId: string;
  title: string;
  descriptionText: string;
  /** ISO 8601 UTC */
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  organizer: string | null;
  /** 소스가 구조화해서 주는 perks (Engage benefitNames 등). LLM 추출 결과와 union됨 */
  perks: Perk[];
  isFree: boolean;
  category: Category;
  imageUrl: string | null;
  sourceUrl: string | null;
  raw: unknown;
}

export interface SourceAdapter {
  name: SourceName;
  fetchEvents(opts: { days: number }): Promise<NormalizedEvent[]>;
}
