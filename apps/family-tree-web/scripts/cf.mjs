// Cloudflare build/deploy wrapper: `node scripts/cf.mjs build|deploy|upload [extra wrangler args]`.
//  1. Nx loads the app's .env.local into the task environment, and Next never overrides variables that are
//     already set — so a build run through Nx would inline the *local* NEXT_PUBLIC_* values. Drop every key
//     defined in this app's .env* files so Next resolves them itself (.env.production.local wins for builds).
//  2. opennextjs-cloudflare build
//  3. scrub-open-next-env.mjs (keep only NEXT_PUBLIC_* in the Worker bundle)
//  4. opennextjs-cloudflare deploy|upload (optional)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [action = 'build', ...extra] = process.argv.slice(2);
if (!['build', 'deploy', 'upload'].includes(action)) {
  console.error('usage: node scripts/cf.mjs build|deploy|upload [wrangler args]');
  process.exit(2);
}

const env = { ...process.env };
for (const file of fs.readdirSync('.').filter((f) => f.startsWith('.env') && f !== '.env.example')) {
  for (const [, key] of fs.readFileSync(file, 'utf8').matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=/gm)) delete env[key];
}

/** node_modules/.bin/<name>, searched upwards (the workspace root holds the deps). */
function bin(name) {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules/.bin', name);
    if (fs.existsSync(candidate)) return candidate;
    if (dir === path.dirname(dir)) return name;
  }
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', env });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run(bin('opennextjs-cloudflare'), ['build']);
run(process.execPath, ['scripts/scrub-open-next-env.mjs']);
if (action !== 'build') run(bin('opennextjs-cloudflare'), [action, ...extra]);
