import { NextResponse } from 'next/server';
import { and, count, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_MS,
  createSessionToken,
  verifyAdminCredentials,
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** IP당 15분 내 실패 5회 → 잠금 */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();
    const [{ failures }] = await db
      .select({ failures: count() })
      .from(schema.adminLoginAttempts)
      .where(
        and(
          eq(schema.adminLoginAttempts.ip, ip),
          gt(schema.adminLoginAttempts.createdAt, windowStart),
        ),
      );
    if (failures >= MAX_FAILURES) {
      return Response.json({ error: 'locked' }, { status: 429 });
    }

    const body = (await req.json().catch(() => null)) as {
      id?: unknown;
      password?: unknown;
    } | null;
    const id = String(body?.id ?? '');
    const password = String(body?.password ?? '');
    const ok = !!id && !!password && (await verifyAdminCredentials(id, password));

    if (!ok) {
      await db
        .insert(schema.adminLoginAttempts)
        .values({ ip, createdAt: new Date().toISOString() });
      return Response.json({ error: 'invalid credentials' }, { status: 401 });
    }

    // 성공: 해당 IP의 실패 기록 정리
    await db.delete(schema.adminLoginAttempts).where(eq(schema.adminLoginAttempts.ip, ip));
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_MS / 1000,
    });
    return res;
  } catch (err) {
    console.error('[admin login] error:', err);
    return Response.json({ error: 'internal' }, { status: 502 });
  }
}
