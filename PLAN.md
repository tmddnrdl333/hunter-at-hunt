# hunter-at-hunt — NCSU 이벤트 트래커

NCSU 학생을 위한 교내 이벤트 집계 웹앱. 공개 API들에서 이벤트를 수집하고,
LLM으로 정제(보상 추출·요약)해서 깔끔한 UI로 보여준다. 핵심 기능은 **perks 필터**
(free food, t-shirt, swag 등). 인증 없음, 전면 공개, 수익 없음.

## 데이터 소스 (전부 공개 API, 인증 불필요)

| # | 소스 | 엔드포인트 | 내용 | 비고 |
|---|---|---|---|---|
| 1 | Localist (공식 캘린더) | `calendar.ncsu.edu/api/2/events?days=N&pp=100&page=N` | 전교 이벤트 ~250개/월 | 페이지네이션. `event_instances`로 반복 회차 전개 필요. 시간대 `-04:00` 로컬 오프셋 |
| 2 | CampusLabs Engage (동아리) | `getinvolved.ncsu.edu/api/discovery/event/search?endsAfter=...&status=Approved&take=100` | 동아리 이벤트 ~50개/월 | `benefitNames`에 "Free Food"/"Free Stuff" 구조화되어 있음. 시각은 진짜 UTC |
| 3 | 학과 WordPress | `{dept}.ncsu.edu/wp-json/tribe/events/v1/events` | 학과 세미나 | 확인됨: csc, ise, chemistry.sciences. 학과 목록은 설정으로 관리, 404는 스킵. 같은 세미나가 회차별 중복으로 나옴 → 정리 필요 |
| 4 | Sidearm (스포츠) | `gopack.com/api/v2/Calendar/events?date=...` | 경기 일정 | 선택 소스. UI에서 카테고리 분리 |

v2 후보: Reddit r/NCSU (OAuth 필요), 인스타그램(사실상 불가), 학과 뉴스레터.
참고: 도서관 이벤트는 Localist에 이미 포함됨. 커리어페어(ePACK/Handshake)는 로그인 벽 → 제외.

## 통합 스키마 (events 테이블)

- `id` PK
- `source` ('localist'|'engage'|'wordpress'|'sidearm') + `source_id` → UNIQUE(source, source_id) upsert 키
- `title`, `description_text`, `summary` (LLM 생성)
- `starts_at`, `ends_at` — **UTC로 통일 저장**, 렌더링은 America/New_York
- `location_name`, `address`, `lat`, `lng`
- `organizer`
- `perks` — 태그 배열: `free_food` `drinks` `tshirt` `swag` `prize` `free_stuff` (Engage benefitNames 매핑 + LLM 추출)
- `is_free` bool
- `category` ('campus'|'club'|'academic'|'sports')
- `image_url`, `source_url`
- `view_count` int default 0 — 카드 클릭 시 API route로 증가
- `raw` JSON (원본 보존), `created_at`, `updated_at`

## 파이프라인

```
scripts/ingest  (로컬: npm run ingest / 배포 후: Vercel Cron → API route가 동일 로직 호출)
  1. 소스 어댑터 4개 병렬 fetch → 통합 스키마로 정규화
  2. 중복 제거: 정규화 제목 유사(>0.75) AND 시작시각 정확 일치 → 병합
     ("Interest Meeting" 같은 흔한 제목의 오병합 방지를 위해 시각 일치 필수)
  3. 신규/변경(updated_at 비교) 이벤트만 Gemini에 배치(10~20개/호출):
     description → { summary(1문장), perks[] } JSON (responseSchema로 강제)
  4. DB upsert
```

## LLM

- **Gemini 2.5 Flash, Google AI Studio 무료 티어** (하루 ~10회 호출 ≪ 무료 한도 250+/일)
- 키는 `.env.local`의 `GEMINI_API_KEY` (커밋 금지)
- 호출부는 `lib/llm.ts` 인터페이스 하나로 격리 — 모델/프로바이더 교체는 이 파일만 수정
- 실패 시 폴백: 키워드 매칭으로 perks 추출 (LLM 없이도 동작하는 구조)

## 스택

- Next.js (App Router, TS, Tailwind) — 프론트+API route 단일 프로젝트
- DB: 로컬은 SQLite(better-sqlite3 + Drizzle), 배포 시 **Supabase Postgres**로 전환
  (Drizzle 스키마 재사용, 드라이버만 postgres-js로 교체)
- 배포(나중에): Vercel + Vercel Cron + Vercel Analytics(사이트 트래픽)
- 이벤트별 조회수는 자체 DB 집계

## 성능/지역 (속도가 이탈률을 결정)

- Vercel 리전: **us-east-1 (iad1, 버지니아)** — NCSU와 같은 동부
- Supabase 리전: **us-east-1** — 서버와 같은 리전에 생성 (프로젝트 생성 시 선택, 나중에 못 바꿈)
- 무료 티어로 시작: Supabase Free(500MB, 충분함). 주의: 1주 넘게 활동 없으면 프로젝트 일시정지되는데
  매일 cron이 DB에 쓰기 때문에 해당 없음
- 필터/검색은 전부 클라이언트 메모리에서 처리(2주치 ~300건이라 payload 작음) → 서버 왕복 0

## 데이터 2계층 구조

- `raw_events` — 수집 원본 로그, append-only. 매 ingest마다 쌓이기만 함 (히스토리/디버깅/추후 분석용)
- `events` — 서빙 테이블. **upcoming 2주만 유지**, 매 ingest 끝에 지난 이벤트 자동 삭제
- 검색/필터/UI는 오직 `events`만 조회 → 테이블이 항상 작아서 빠름
- raw_events가 커지면(수개월 뒤) 오래된 로그 주기 삭제 or 아카이브

## 신선도 UX

- 페이지에 데이터 갱신 시각 표시 ("Data updated Aug 29, 9:00 AM ET")
- 페이지를 30분+ 열어둔 채 재방문(탭 복귀)하면 outdated 배너 표시 → Reload 버튼

## UI 방향

- 단일 페이지 리스트/카드 뷰, 모바일 우선 반응형
- 헤더: `public/banner.png` (늑대 마스코트 + 타이틀 + 태그라인), 반응형 w-full, 밴드 색 #a30404
- 필터는 라벨 그룹으로 구분, 전부 **단일 선택** (해제 = 전체):
  - Freebies(UI 명칭. 내부/DB는 perks 유지): 🍕 Free Food / 🧋 Drinks / 👕 T-shirt / 🎁 Goodies
    (DB에는 6태그 유지, UI에서 swag+prize+free_stuff → Goodies로 묶음)
  - When: Today(날짜) / Tomorrow(날짜) / 📅 날짜범위 선택(네이티브 date input)
  - Type: Campus / Clubs / Academic / Sports (소스 기반 카테고리)
- 카드: 이벤트명, perks 뱃지(없으면 회색 "No perks"), 시간·장소·주최, LLM 요약, 출처 링크
- 무한 스크롤 (25개씩, 스크롤 이벤트 기반 — IntersectionObserver는 일부 임베디드 환경에서 미동작)
- view_count는 집계만 유지 (정렬 UI는 제거함, 추후 데이터 쌓이면 재고)

## 마일스톤

1. ✅ 소스 조사·스키마 설계·계획 픽스
2. 스캐폴딩 + DB 스키마 + 어댑터 4개 + ingest 스크립트 (LLM 없이 동작)
3. Gemini 정제 붙이기 (perks + summary)
4. UI (리스트, 필터, 조회수)
5. 배포 (Vercel + Cron + Analytics) — cron 설정법은 이 단계에서
