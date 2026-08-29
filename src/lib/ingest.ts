/**
 * 수집 파이프라인: 소스 fetch → 정규화 → 중복 병합 → 신규/변경만 LLM 정제 → DB upsert
 * 로컬 스크립트(scripts/ingest.ts)와 Vercel Cron route가 공용으로 호출한다.
 */
import { createHash } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { db, schema } from './db';
import { dedupe } from './dedupe';
import { enrichWithLlm } from './llm';
import { keywordPerks } from './perks';
import { adapters } from './sources';
import type { NormalizedEvent, Perk } from './types';

const LLM_BATCH_SIZE = 10;

export interface IngestOptions {
  /** 서빙 윈도우 (기본 14일). 지난 이벤트는 매 실행마다 서빙 테이블에서 제거 */
  days?: number;
  useLlm?: boolean;
}

export interface IngestResult {
  collected: number;
  merged: number;
  unchanged: number;
  inserted: number;
  updated: number;
  purged: number;
  total: number;
  perkCount: Record<string, number>;
}

function contentHash(e: NormalizedEvent): string {
  // startsAt 포함: 시간이 바뀐 이벤트도 갱신 대상이 되도록
  return createHash('sha1')
    .update(`${e.title}\n${e.descriptionText}\n${e.startsAt}`)
    .digest('hex');
}

export async function runIngest(opts: IngestOptions = {}): Promise<IngestResult> {
  const days = opts.days ?? 14;
  const useLlm = opts.useLlm ?? true;
  console.log(`== hunter-at-hunt ingest (days=${days}, llm=${useLlm}) ==\n`);

  // 1. 수집
  const settled = await Promise.allSettled(
    adapters.map((a) => a.fetchEvents({ days })),
  );
  const collected: NormalizedEvent[] = [];
  for (const [i, r] of settled.entries()) {
    const name = adapters[i].name;
    if (r.status === 'fulfilled') {
      console.log(`  [${name}] ${r.value.length}건`);
      collected.push(...r.value);
    } else {
      console.error(`  [${name}] 수집 실패: ${r.reason}`);
    }
  }

  // 1.5 원본 로그 적재 (append-only, 히스토리 보존용) — 100건씩 벌크 insert
  const runAt = new Date().toISOString();
  const rawRows = collected.map((e) => ({
    runAt,
    source: e.source,
    sourceId: e.sourceId,
    title: e.title,
    startsAt: e.startsAt,
    payload: e.raw,
  }));
  for (let i = 0; i < rawRows.length; i += 100) {
    await db.insert(schema.rawEvents).values(rawRows.slice(i, i + 100));
  }

  // 2. 중복 병합
  const merged = dedupe(collected);
  console.log(`\n중복 병합: ${collected.length} → ${merged.length}건`);

  // 3. 신규/변경 판별 — 기존 행은 한 번에 로드 (왕복 1회)
  const now = new Date().toISOString();
  type Pending = { event: NormalizedEvent; hash: string; existingId: number | null };
  const existingRows = await db
    .select({
      id: schema.events.id,
      source: schema.events.source,
      sourceId: schema.events.sourceId,
      contentHash: schema.events.contentHash,
      summary: schema.events.summary,
    })
    .from(schema.events);
  const existingMap = new Map(
    existingRows.map((r) => [`${r.source} ${r.sourceId}`, r]),
  );

  const toEnrich: Pending[] = [];
  let unchanged = 0;
  for (const e of merged) {
    const hash = contentHash(e);
    const existing = existingMap.get(`${e.source} ${e.sourceId}`);
    // summary가 없는 행은 이전 실행에서 LLM 폴백 처리된 것 → 해시가 같아도 재정제
    if (existing && existing.contentHash === hash && (existing.summary || !useLlm)) {
      unchanged++;
      continue;
    }
    toEnrich.push({ event: e, hash, existingId: existing?.id ?? null });
  }
  console.log(`변경 없음 ${unchanged}건 / 정제 대상 ${toEnrich.length}건`);

  // 4. LLM 정제 (배치) — 실패 시 키워드 폴백
  const enriched = new Map<Pending, { summary: string | null; perks: Perk[] }>();
  for (let i = 0; i < toEnrich.length; i += LLM_BATCH_SIZE) {
    const batch = toEnrich.slice(i, i + LLM_BATCH_SIZE);
    let results = null;
    if (useLlm) {
      results = await enrichWithLlm(
        batch.map((p) => ({
          title: p.event.title,
          description: p.event.descriptionText,
        })),
      );
      console.log(
        `  LLM 배치 ${Math.floor(i / LLM_BATCH_SIZE) + 1}/${Math.ceil(toEnrich.length / LLM_BATCH_SIZE)} ${results ? 'ok' : 'fallback'}`,
      );
    }
    batch.forEach((p, j) => {
      const r = results?.[j];
      enriched.set(p, {
        summary: r?.summary || null,
        perks: r?.perks ?? keywordPerks(`${p.event.title} ${p.event.descriptionText}`),
      });
    });
  }

  // 5. upsert
  let inserted = 0;
  let updated = 0;
  for (const p of toEnrich) {
    const e = p.event;
    const extra = enriched.get(p)!;
    const perks = [...new Set([...e.perks, ...extra.perks])];
    const row = {
      title: e.title,
      descriptionText: e.descriptionText,
      summary: extra.summary,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      locationName: e.locationName,
      address: e.address,
      lat: e.lat,
      lng: e.lng,
      organizer: e.organizer,
      perks,
      isFree: e.isFree || perks.length > 0,
      category: e.category,
      imageUrl: e.imageUrl,
      sourceUrl: e.sourceUrl,
      contentHash: p.hash,
      raw: e.raw,
      updatedAt: now,
    };
    if (p.existingId != null) {
      await db
        .update(schema.events)
        .set(row)
        .where(eq(schema.events.id, p.existingId));
      updated++;
    } else {
      await db
        .insert(schema.events)
        .values({ ...row, source: e.source, sourceId: e.sourceId, createdAt: now });
      inserted++;
    }
  }

  // 6. 정리: 서빙 테이블은 지난 이벤트 즉시 제거,
  //    로그(raw_events)는 이벤트 시작일 2일 경과분 삭제 (무한 누적 방지)
  const purgedRows = await db
    .delete(schema.events)
    .where(lt(schema.events.startsAt, now))
    .returning({ id: schema.events.id });
  const logCutoff = new Date(Date.now() - 2 * 86400_000).toISOString();
  await db.delete(schema.rawEvents).where(lt(schema.rawEvents.startsAt, logCutoff));

  const total = await db.$count(schema.events);
  console.log(
    `\nupsert 완료: 신규 ${inserted} / 갱신 ${updated} / 지난 이벤트 정리 ${purgedRows.length} / 서빙 테이블 총 ${total}건`,
  );

  // perks 통계
  const withPerks = await db.select({ perks: schema.events.perks }).from(schema.events);
  const perkCount = new Map<string, number>();
  for (const r of withPerks) {
    for (const perk of r.perks) perkCount.set(perk, (perkCount.get(perk) ?? 0) + 1);
  }
  console.log('perks 분포:', Object.fromEntries(perkCount));

  return {
    collected: collected.length,
    merged: merged.length,
    unchanged,
    inserted,
    updated,
    purged: purgedRows.length,
    total,
    perkCount: Object.fromEntries(perkCount),
  };
}
