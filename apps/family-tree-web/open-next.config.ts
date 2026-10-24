import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

// Prerendered pages (culture hub) are cached in R2 — the setup recommended by OpenNext.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
