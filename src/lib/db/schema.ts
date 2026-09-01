import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Perk } from '../types';

/** Supabase 관리 스키마 읽기 전용 매핑 — 댓글 작성자 이메일 조인용 */
export const authUsers = pgSchema('auth').table('users', {
  id: uuid('id').primaryKey(),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
});

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

/**
 * 이벤트 댓글. 2뎁스 제한(parent_id가 있는 댓글에는 답글 불가 — API에서 강제).
 * hidden_at: 서로 다른 사용자 신고 3건 도달 시 자동 숨김(관리자가 복구/확정 처리).
 * deleted_at: 작성자/관리자 삭제 — 대댓글이 있으면 "[deleted]"로 표시.
 */
export const comments = pgTable(
  'comments',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    parentId: integer('parent_id'),
    body: text('body').notNull(),
    createdAt: text('created_at').notNull(),
    hiddenAt: text('hidden_at'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('comments_event_idx').on(t.eventId, t.createdAt)],
);

export const commentLikes = pgTable(
  'comment_likes',
  {
    userId: uuid('user_id').notNull(),
    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] })],
);

/** PK(user, comment) — 같은 사람의 중복 신고를 구조적으로 차단 */
export const commentReports = pgTable(
  'comment_reports',
  {
    userId: uuid('user_id').notNull(),
    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] })],
);

/** "I went" 참석 리포트 — 설문 필드는 전부 옵셔널. Going은 likes로 표현 */
export const attendance = pgTable(
  'attendance',
  {
    userId: uuid('user_id').notNull(),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    /** 방문 시간대 텍스트 (예: "5:30 PM") */
    visitedAt: text('visited_at'),
    /** 혼잡도: quiet | moderate | packed */
    crowd: text('crowd'),
    foodRanOut: boolean('food_ran_out'),
    ranOutAt: text('ran_out_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

/** 정지 계정 — getAuthedUser에서 검사해 모든 보호 기능 차단 */
export const bannedUsers = pgTable('banned_users', {
  userId: uuid('user_id').primaryKey(),
  reason: text('reason'),
  createdAt: text('created_at').notNull(),
});

export const rawEvents = pgTable('raw_events', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  runAt: text('run_at').notNull(),
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  title: text('title').notNull(),
  startsAt: text('starts_at').notNull(),
  payload: jsonb('payload'),
});
