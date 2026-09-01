import { and, count, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getAuthedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_TITLE = 120;
const MAX_CONTENT = 4000;
/** 사용자당 시간당 발송 한도 — 인박스/Resend 쿼터 보호 */
const RATE_LIMIT_PER_HOUR = 5;

/**
 * 로그인 사용자의 피드백을 운영자 이메일로 발송 (Resend API).
 * 필요 env: RESEND_API_KEY, FEEDBACK_TO (수신 주소)
 */
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_TO;
  if (!apiKey || !to) {
    return Response.json({ error: 'feedback not configured' }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    content?: unknown;
  } | null;
  // 개행 제거: 메일 제목 헤더 인젝션 방지
  const title = String(body?.title ?? '').replace(/[\r\n]+/g, ' ').trim();
  const content = String(body?.content ?? '').trim();
  if (!title || !content) {
    return Response.json({ error: 'title and content required' }, { status: 400 });
  }

  try {
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(schema.feedbackLog)
      .where(
        and(
          eq(schema.feedbackLog.userId, user.id),
          gt(schema.feedbackLog.createdAt, hourAgo),
        ),
      );
    if (recent >= RATE_LIMIT_PER_HOUR) {
      return Response.json({ error: 'rate limited' }, { status: 429 });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // 주의: onboarding@resend.dev(샌드박스 발신자)는 Resend 계정 소유자의
        // 이메일로만 발송 가능 — FEEDBACK_TO를 바꾸려면 도메인 인증이 필요
        from: 'Hunter at Hunt <onboarding@resend.dev>',
        to: [to],
        reply_to: user.email,
        subject: `[Hunter at Hunt] ${title.slice(0, MAX_TITLE)}`,
        text: `From: ${user.email}\n\n${content.slice(0, MAX_CONTENT)}`,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.error('[feedback] resend error:', res.status, (await res.text()).slice(0, 200));
      return Response.json({ error: 'send failed' }, { status: 502 });
    }

    await db.insert(schema.feedbackLog).values({
      userId: user.id,
      createdAt: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (err) {
    // Resend 타임아웃/DB 순단 포함 — 상세는 서버 로그에만
    console.error('[feedback] error:', err);
    return Response.json({ error: 'internal' }, { status: 502 });
  }
}
