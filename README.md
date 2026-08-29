# 🐺 Hunter at Hunt

**Free food hunter at NC State.**

NC State 캠퍼스의 이벤트를 매일 자동 수집해 한 곳에 모아 보여주는 웹앱.
무료 음식·음료·티셔츠·굿즈가 나오는 이벤트를 필터 한 번으로 찾을 수 있다.

## Architecture

```
┌─ Sources (공개 API 4종) ──────────────────────────┐
│ Localist(공식 캘린더) · Engage(동아리)             │
│ 학과 WordPress(세미나) · Sidearm(스포츠 홈경기)    │
└──────────────┬───────────────────────────────────┘
               ▼  매일 1회 (Vercel Cron → /api/cron/ingest)
        정규화 → 중복 병합
               ▼
        Gemini 2.5 Flash (무료 티어)
        · 한 줄 요약 생성
        · freebies 태그 추출 (free_food/drinks/tshirt/…)
        · 신규·변경 이벤트만 호출 (content hash 비교)
               ▼
        Supabase Postgres (us-east-1)
        · events: 서빙 테이블, upcoming 2주만 유지
        · raw_events: 수집 원본 로그 (시작일 +2일 후 삭제)
               ▼
        Next.js (App Router) on Vercel
        · 필터: Freebies / When(날짜 범위) / Type — 전부 클라이언트에서 즉시
        · 무한 스크롤, 이벤트 조회수 집계
```

- **수집·LLM 트리거는 cron뿐** — 배포·페이지 접속과 무관. 웹앱은 DB를 읽기만 한다.
- 같은 이벤트 재수집 시 내용 해시가 같으면 통째로 스킵 → LLM 비용은 신규/변경분에만 발생.
- LLM 실패 시 키워드 매칭으로 폴백 — 파이프라인은 LLM 없이도 동작한다.

## Development

```bash
npm install
npm run dev        # 웹 (localhost:3000)
npm run ingest     # 수집 파이프라인 수동 실행 (--days=N --no-llm)
npm run db:push    # 스키마를 DB에 반영 (drizzle-kit)
```

`.env.local`에 `DATABASE_URL`(Supabase transaction pooler), `GEMINI_API_KEY` 필요.
