/** HTML → 플레인 텍스트 (설명문 정리용, 완벽할 필요 없음) */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;|&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 오프셋 없는 미 동부시간 문자열("2026-09-05T18:00:00")을 UTC Date로 */
export function easternToUtc(naive: string): Date {
  const guess = new Date(naive + 'Z');
  // 같은 머신 로컬 기준으로 파싱한 두 값의 차 → 머신 타임존이 상쇄되어 순수 NY 오프셋만 남음
  const asTz = (tz: string) =>
    new Date(guess.toLocaleString('en-US', { timeZone: tz })).getTime();
  const nyOffsetMs = asTz('America/New_York') - asTz('UTC');
  return new Date(guess.getTime() - nyOffsetMs);
}

export function toIso(d: Date | string): string {
  return (typeof d === 'string' ? new Date(d) : d).toISOString();
}

/** 제목 정규화: 소문자, 영숫자만 */
export function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dice coefficient (bigram) — 제목 유사도 0~1 */
export function titleSimilarity(a: string, b: string): number {
  const na = normTitle(a);
  const nb = normTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const ma = bigrams(na);
  const mb = bigrams(nb);
  let overlap = 0;
  let total = 0;
  for (const [bg, ca] of ma) {
    overlap += Math.min(ca, mb.get(bg) ?? 0);
    total += ca;
  }
  for (const cb of mb.values()) total += cb;
  return total === 0 ? 0 : (2 * overlap) / total;
}

export async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json', 'User-Agent': 'hunter-at-hunt/0.1' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}
