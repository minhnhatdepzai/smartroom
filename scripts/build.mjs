import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'dist');

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all([
  cp(path.join(projectRoot, 'index.html'), path.join(outputDirectory, 'index.html')),
  cp(path.join(projectRoot, 'src'), path.join(outputDirectory, 'src'), { recursive: true }),
  cp(path.join(projectRoot, 'assets'), path.join(outputDirectory, 'assets'), { recursive: true }),
]);

console.log('Đã tạo dist/ cho Cloudflare Workers Static Assets.');
