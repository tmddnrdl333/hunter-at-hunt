/** URL 파라미터의 int4 id 검증 — 십진 숫자만, 범위 내. 아니면 null */
export function parseIntId(idParam: string): number | null {
  if (!/^\d{1,10}$/.test(idParam)) return null;
  const id = Number(idParam);
  if (id <= 0 || id > 2147483647) return null;
  return id;
}
