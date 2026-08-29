import type { Perk } from './types';

/** Engage benefitNames → 우리 perk 태그 */
export function mapEngageBenefits(benefitNames: string[]): Perk[] {
  const out = new Set<Perk>();
  for (const b of benefitNames) {
    const s = b.toLowerCase();
    if (s.includes('food')) out.add('free_food');
    else if (s.includes('stuff')) out.add('free_stuff');
  }
  return [...out];
}

/**
 * 키워드 기반 perks 추출 — LLM 실패/미설정 시 폴백.
 * ("Boba Breakdown" 같은 오탐 가능성이 있어 정확도는 LLM보다 낮음)
 */
export function keywordPerks(text: string): Perk[] {
  const s = text.toLowerCase();
  const out = new Set<Perk>();
  const hit = (kws: string[]) => kws.some((k) => s.includes(k));

  if (
    hit([
      'free food',
      'free pizza',
      'pizza provided',
      'food provided',
      'food will be provided',
      'lunch provided',
      'dinner provided',
      'breakfast provided',
      'refreshments',
      'snacks provided',
      'free snacks',
      'ice cream',
      'free donut',
    ])
  )
    out.add('free_food');
  if (hit(['free coffee', 'coffee provided', 'free boba', 'boba provided', 'bubble tea provided', 'drinks provided']))
    out.add('drinks');
  if (hit(['t-shirt', 'tshirt', 'free shirt'])) out.add('tshirt');
  if (hit(['swag', 'goodie', 'giveaway', 'merch'])) out.add('swag');
  if (hit(['prize', 'raffle'])) out.add('prize');
  return [...out];
}
