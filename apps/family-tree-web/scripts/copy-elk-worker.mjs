// Copies the elkjs web worker into public/ so tree layout can run off the main thread.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const src = require.resolve('elkjs/lib/elk-worker.min.js');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'elk-worker.min.js');
mkdirSync(dirname(out), { recursive: true });
copyFileSync(src, out);
