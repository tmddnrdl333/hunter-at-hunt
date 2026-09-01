import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * 관리자 인증 — env 기반 단일 계정.
 * ADMIN_ID: 로그인 아이디
 * ADMIN_PASSWORD_HASH: "salt:hash" (hex) — scripts/hash-admin-password.ts로 생성
 * ADMIN_SESSION_SECRET: 세션 쿠키 서명용 임의의 긴 문자열
 */
const COOKIE_NAME = 'hah_admin';
const SESSION_TTL_MS = 7 * 24 * 3600_000;

export function adminConfigured(): boolean {
  return !!(
    process.env.ADMIN_ID &&
    process.env.ADMIN_PASSWORD_HASH &&
    process.env.ADMIN_SESSION_SECRET
  );
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyAdminCredentials(id: string, password: string): boolean {
  if (!adminConfigured()) return false;
  const stored = process.env.ADMIN_PASSWORD_HASH!;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  // 아이디/비밀번호 모두 타이밍 안전 비교
  const idOk =
    id.length === process.env.ADMIN_ID!.length &&
    timingSafeEqual(Buffer.from(id), Buffer.from(process.env.ADMIN_ID!));
  const pwOk = candidate.length === expected.length && timingSafeEqual(candidate, expected);
  return idOk && pwOk;
}

function sign(payload: string): string {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET!)
    .update(payload)
    .digest('hex');
}

export function createSessionToken(): string {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !adminConfigured()) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  const expected = sign(exp);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return false;
  }
  return Number(exp) > Date.now();
}

/** 서버 컴포넌트/라우트에서 관리자 세션 확인 */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export const ADMIN_COOKIE = COOKIE_NAME;
export const ADMIN_SESSION_TTL_MS = SESSION_TTL_MS;
