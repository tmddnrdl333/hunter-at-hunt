/**
 * 수집 파이프라인: 소스 fetch → 정규화 → 중복 병합 → 신규/변경만 LLM 정제 → DB upsert
 * 실행: npm run ingest  (옵션: --days=30 --no-llm)
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { and, eq, lt } from 'drizzle-orm';
import { db, schema } from '../src/lib/db';
import { dedupe } from '../src/lib/dedupe';
import { enrichWithLlm } from '../src/lib/llm';
import { keywordPerks } from '../src/lib/perks';
import { adapters } from '../src/lib/sources';
import type { NormalizedEvent, Perk } from '../src/lib/types';

// .env.local 로드 (의존성 없이)
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* .env.local 없으면 무시 */
}

// 서빙 윈도우: 현재~2주. 지난 이벤트는 매 실행마다 서빙 테이블에서 제거된다.
const DAYS = Number(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 14);
const USE_LLM = !process.argv.includes('--no-llm');
const LLM_BATCH_SIZE = 10;

function contentHash(e: NormalizedEvent): string {
  // startsAt 포함: 시간이 바뀐 이벤트도 갱신 대상이 되도록
  return createHash('sha1')
    .update(`${e.title}\n${e.descriptionText}\n${e.startsAt}`)
    .digest('hex');
}

async function main() {
  console.log(`== hunter-at-hunt ingest (days=${DAYS}, llm=${USE_LLM}) ==\n`);

  // 1. 수집
  const settled = await Promise.allSettled(
    adapters.map((a) => a.fetchEvents({ days: DAYS })),
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

  // 1.5 원본 로그 적재 (append-only, 히스토리 보존용)
  const runAt = new Date().toISOString();
  for (const e of collected) {
    db.insert(schema.rawEvents)
      .values({
        runAt,
        source: e.source,
        sourceId: e.sourceId,
        title: e.title,
        startsAt: e.startsAt,
        payload: e.raw,
      })
      .run();
  }

  // 2. 중복 병합
  const merged = dedupe(collected);
  console.log(`\n중복 병합: ${collected.length} → ${merged.length}건`);

  // 3. 신규/변경 판별
  const now = new Date().toISOString();
  type Pending = { event: NormalizedEvent; hash: string; existingId: number | null };
  const toEnrich: Pending[] = [];
  let unchanged = 0;
  for (const e of merged) {
    const hash = contentHash(e);
    const existing = db
      .select({
        id: schema.events.id,
        contentHash: schema.events.contentHash,
        summary: schema.events.summary,
      })
      .from(schema.events)
      .where(
        and(
          eq(schema.events.source, e.source),
          eq(schema.events.sourceId, e.sourceId),
        ),
      )
      .get();
    // summary가 없는 행은 이전 실행에서 LLM 폴백 처리된 것 → 해시가 같아도 재정제
    if (existing && existing.contentHash === hash && (existing.summary || !USE_LLM)) {
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
    if (USE_LLM) {
      results = await enrichWithLlm(
        batch.map((p) => ({
          title: p.event.title,
          description: p.event.descriptionText,
        })),
      );
      process.stdout.write(
        `  LLM 배치 ${Math.floor(i / LLM_BATCH_SIZE) + 1}/${Math.ceil(toEnrich.length / LLM_BATCH_SIZE)} ${results ? 'ok' : 'fallback'}\n`,
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
      db.update(schema.events).set(row).where(eq(schema.events.id, p.existingId)).run();
      updated++;
    } else {
      db.insert(schema.events)
        .values({ ...row, source: e.source, sourceId: e.sourceId, createdAt: now })
        .run();
      inserted++;
    }
  }

  // 6. 서빙 테이블 정리: 지난 이벤트 제거 (히스토리는 raw_events에 남음)
  const purged = db
    .delete(schema.events)
    .where(lt(schema.events.startsAt, now))
    .run().changes;

  const total = db.$count(schema.events);
  console.log(
    `\nupsert 완료: 신규 ${inserted} / 갱신 ${updated} / 지난 이벤트 정리 ${purged} / 서빙 테이블 총 ${await total}건`,
  );

  // perks 통계
  const withPerks = db.select({ perks: schema.events.perks }).from(schema.events).all();
  const perkCount = new Map<string, number>();
  for (const r of withPerks) {
    for (const perk of r.perks) perkCount.set(perk, (perkCount.get(perk) ?? 0) + 1);
  }
  console.log('perks 분포:', Object.fromEntries(perkCount));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
