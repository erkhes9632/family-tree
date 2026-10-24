// OpenNext compiles every .env* file (incl. .env.local / .env.production.local) into
// .open-next/cloudflare/next-env.mjs, which wrangler then bundles into the deployed Worker.
// Keep only public NEXT_PUBLIC_* values there; runtime secrets (CLERK_SECRET_KEY) are Worker secrets.
// Runs after `opennextjs-cloudflare build`, before deploy/upload.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const file = path.join(process.cwd(), '.open-next/cloudflare/next-env.mjs');
if (!fs.existsSync(file)) {
  console.error(`scrub-open-next-env: ${file} not found (run opennextjs-cloudflare build first)`);
  process.exit(1);
}
const envs = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
const removed = new Set();
const content = Object.entries(envs)
  .map(([mode, vars]) => {
    const kept = Object.fromEntries(
      Object.entries(vars).filter(([key]) => {
        const keep = key.startsWith('NEXT_PUBLIC_');
        if (!keep) removed.add(key);
        return keep;
      }),
    );
    return `export const ${mode} = ${JSON.stringify(kept)};\n`;
  })
  .join('');
fs.writeFileSync(file, content);
console.log(`scrub-open-next-env: kept NEXT_PUBLIC_* only; removed ${removed.size ? [...removed].join(', ') : 'nothing'}`);
