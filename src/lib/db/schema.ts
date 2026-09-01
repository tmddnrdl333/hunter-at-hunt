import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
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
/**
 * 이벤트 좋아요. user_id는 Supabase auth.users의 id (별도 profile 테이블 없음).
 * 개수는 모두에게 공개, 누르기는 로그인 필요. 접근은 항상 서버 API 경유.
 */
export const likes = pgTable(
  'likes',
  {
    userId: uuid('user_id').notNull(),
    // FK cascade: 이벤트가 purge되면 좋아요도 함께 삭제 (고아 행 방지)
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

/** 피드백 발송 기록 — 사용자별 레이트 리밋 용도. 24시간 경과분은 ingest가 정리 */
export const feedbackLog = pgTable(
  'feedback_log',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid('user_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('feedback_log_user_time').on(t.userId, t.createdAt)],
);

export const rawEvents = pgTable('raw_events', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  runAt: text('run_at').notNull(),
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  title: text('title').notNull(),
  startsAt: text('starts_at').notNull(),
  payload: jsonb('payload'),
});
