// 将 Pagefind 输出复制到 public/ 目录，使 dev 模式下也能使用搜索
import { cpSync, existsSync } from 'node:fs';

const src = 'dist/client/pagefind';
const dest = 'public/pagefind';

if (existsSync(src)) {
  cpSync(src, dest, { recursive: true });
  console.log('  Pagefind: copied to public/pagefind/ (available in dev mode)');
} else {
  console.log('  Pagefind: dist/client/pagefind not found, skipping copy');
}
