import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_MS,
  createSessionToken,
  verifyAdminCredentials,
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    id?: unknown;
    password?: unknown;
  } | null;
  const id = String(body?.id ?? '');
  const password = String(body?.password ?? '');
  if (!id || !password || !verifyAdminCredentials(id, password)) {
    // 무차별 대입 완화용 소지연
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ error: 'invalid credentials' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  });
  return res;
}
