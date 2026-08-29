import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Perk } from '../types';

export const events = pgTable(
  'events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull(),
    title: text('title').notNull(),
    descriptionText: text('description_text'),
    /** LLM이 생성한 한 줄 요약 */
    summary: text('summary'),
    /** ISO 8601 UTC 문자열 — 사전순 비교가 곧 시간순 비교 */
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at'),
    locationName: text('location_name'),
    address: text('address'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    organizer: text('organizer'),
    perks: jsonb('perks').$type<Perk[]>().notNull().default([]),
    isFree: boolean('is_free').notNull().default(false),
    category: text('category').notNull(),
    imageUrl: text('image_url'),
    sourceUrl: text('source_url'),
    viewCount: integer('view_count').notNull().default(0),
    /** title+description+startsAt 해시 — 변경 감지용. 바뀐 것만 LLM 재정제 */
    contentHash: text('content_hash').notNull(),
    raw: jsonb('raw'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('events_source_uniq').on(t.source, t.sourceId)],
);

export type EventRow = typeof events.$inferSelect;

/**
 * 수집 원본 로그 (append-only). 서빙 테이블(events)과 분리 —
 * events는 upcoming 2주만 유지하고, 히스토리는 여기에만 쌓인다.
 */
export const rawEvents = pgTable('raw_events', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  runAt: text('run_at').notNull(),
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  title: text('title').notNull(),
  startsAt: text('starts_at').notNull(),
  payload: jsonb('payload'),
});
