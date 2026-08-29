// .env.local 로드 (의존성 없이). 다른 import보다 먼저 side-effect import 할 것.
import { readFileSync } from 'node:fs';

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* .env.local 없으면 무시 (배포 환경은 환경변수 직접 주입) */
}
