import path from 'node:path';
import type { NextConfig } from 'next';
import createMDX from '@next/mdx';
import createNextIntlPlugin from 'next-intl/plugin';

const workspaceRoot = path.join(__dirname, '../..');

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  // shared libs live outside the app directory
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  // media is served from signed R2 / Worker URLs; no Next image optimizer on Workers
  images: { unoptimized: true },
  poweredByHeader: false,
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
// plugins are passed by name so they work with Turbopack
const withMDX = createMDX({ options: { remarkPlugins: [['remark-gfm', {}]] } });

export default withNextIntl(withMDX(nextConfig));
