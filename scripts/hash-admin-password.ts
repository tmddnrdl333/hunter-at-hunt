/**
 * 관리자 비밀번호 해시 생성기. 실행: npx tsx scripts/hash-admin-password.ts
 * 비밀번호를 입력하면(화면에 표시되지 않음) env에 넣을 해시를 출력한다.
 * 비밀번호 자체는 어디에도 저장되지 않는다.
 */
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hashPassword } from '../src/lib/admin-auth';

const muted = new Writable({
  write(_chunk, _enc, cb) {
    cb();
  },
});
const rl = createInterface({ input: process.stdin, output: muted, terminal: true });

process.stdout.write('관리자 비밀번호 입력 (입력이 화면에 안 보입니다): ');
rl.question('', (password) => {
  rl.close();
  process.stdout.write('\n');
  if (!password || password.length < 8) {
    console.error('비밀번호는 8자 이상으로 해주세요.');
    process.exit(1);
  }
  console.log('\n.env.local과 Vercel(Secret)에 넣을 값:');
  console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
});
