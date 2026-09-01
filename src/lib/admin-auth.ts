import { createHmac, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';

/**
 * 관리자 인증 — env 기반 단일 계정.
 * ADMIN_ID: 로그인 아이디
 * ADMIN_PASSWORD_HASH: "salt:hash" (hex) — scripts/hash-admin-password.ts로 생성
 * ADMIN_SESSION_SECRET: 세션 쿠키 서명용 임의의 긴 문자열 (32자 이상)
 */
const COOKIE_NAME = 'hah_admin';
const SESSION_TTL_MS = 7 * 24 * 3600_000;

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export function adminConfigured(): boolean {
  return !!(
    process.env.ADMIN_ID &&
    process.env.ADMIN_PASSWORD_HASH &&
    process.env.ADMIN_SESSION_SECRET &&
    process.env.ADMIN_SESSION_SECRET.length >= 32
  );
}

/** 해시 생성 스크립트 전용 (동기여도 무방) */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** 바이트 기준 타이밍 안전 비교 — UTF-16 길이/UTF-8 바이트 불일치로 인한 예외 방지 */
function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function verifyAdminCredentials(id: string, password: string): Promise<boolean> {
  if (!adminConfigured()) return false;
  const stored = process.env.ADMIN_PASSWORD_HASH!;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const idOk = safeEqual(Buffer.from(id, 'utf8'), Buffer.from(process.env.ADMIN_ID!, 'utf8'));
  // scrypt는 비동기로 — 이벤트 루프 블로킹(CPU DoS 벡터) 방지
  const candidate = await scryptAsync(password, salt, 64);
  const pwOk = safeEqual(candidate, Buffer.from(hash, 'hex'));
  return idOk && pwOk;
}

/** 비밀번호 해시를 서명에 섞음 — 비밀번호를 바꾸면 기존 세션이 전부 무효화된다 */
function sign(payload: string): string {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET!)
    .update(`${payload}|${process.env.ADMIN_PASSWORD_HASH}`)
    .digest('hex');
}

export function createSessionToken(): string {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !adminConfigured()) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(sign(exp), 'hex');
  if (!safeEqual(sigBuf, expectedBuf)) return false;
  return Number(exp) > Date.now();
}

/** 서버 컴포넌트/라우트에서 관리자 세션 확인 */
export async function isAdmin(): Promise<boolean> {
  try {
    const store = await cookies();
    return verifySessionToken(store.get(COOKIE_NAME)?.value);
  } catch {
    return false;
  }
}

export const ADMIN_COOKIE = COOKIE_NAME;
export const ADMIN_SESSION_TTL_MS = SESSION_TTL_MS;
