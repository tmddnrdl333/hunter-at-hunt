import { getAuthedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_TITLE = 120;
const MAX_CONTENT = 4000;

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
  const title = String(body?.title ?? '').trim();
  const content = String(body?.content ?? '').trim();
  if (!title || !content) {
    return Response.json({ error: 'title and content required' }, { status: 400 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
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
  return Response.json({ ok: true });
}
