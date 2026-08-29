import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type { Perk } from '../types';

export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull(),
    title: text('title').notNull(),
    descriptionText: text('description_text'),
    /** LLM이 생성한 한 줄 요약 */
    summary: text('summary'),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at'),
    locationName: text('location_name'),
    address: text('address'),
    lat: real('lat'),
    lng: real('lng'),
    organizer: text('organizer'),
    perks: text('perks', { mode: 'json' }).$type<Perk[]>().notNull().default([]),
    isFree: integer('is_free', { mode: 'boolean' }).notNull().default(false),
    category: text('category').notNull(),
    imageUrl: text('image_url'),
    sourceUrl: text('source_url'),
    viewCount: integer('view_count').notNull().default(0),
    /** title+description 해시 — 변경 감지용. 바뀐 것만 LLM 재정제 */
    contentHash: text('content_hash').notNull(),
    raw: text('raw', { mode: 'json' }),
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
export const rawEvents = sqliteTable('raw_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runAt: text('run_at').notNull(),
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  title: text('title').notNull(),
  startsAt: text('starts_at').notNull(),
  payload: text('payload', { mode: 'json' }),
});
