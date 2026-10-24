import type { ComponentType } from 'react';

export interface ContentMeta {
  title: string;
  description: string;
}
export interface ContentModule {
  default: ComponentType;
  meta: ContentMeta;
}
type Loader = () => Promise<ContentModule>;

export const CUSTOMS = ['tsagaan-sar', 'naadam', 'us-urgeekh', 'ber-guikh'] as const;
export const GUIDES = ['nine-generations', 'kinship-terms', 'getting-started'] as const;
export type Section = 'customs' | 'guide';

// Explicit map so every MDX file is bundled and statically rendered.
const loaders: Record<string, Record<'mn' | 'en', Loader>> = {
  'customs/tsagaan-sar': { mn: () => import('./customs/tsagaan-sar.mn.mdx'), en: () => import('./customs/tsagaan-sar.en.mdx') },
  'customs/naadam': { mn: () => import('./customs/naadam.mn.mdx'), en: () => import('./customs/naadam.en.mdx') },
  'customs/us-urgeekh': { mn: () => import('./customs/us-urgeekh.mn.mdx'), en: () => import('./customs/us-urgeekh.en.mdx') },
  'customs/ber-guikh': { mn: () => import('./customs/ber-guikh.mn.mdx'), en: () => import('./customs/ber-guikh.en.mdx') },
  'guide/nine-generations': { mn: () => import('./guide/nine-generations.mn.mdx'), en: () => import('./guide/nine-generations.en.mdx') },
  'guide/kinship-terms': { mn: () => import('./guide/kinship-terms.mn.mdx'), en: () => import('./guide/kinship-terms.en.mdx') },
  'guide/getting-started': { mn: () => import('./guide/getting-started.mn.mdx'), en: () => import('./guide/getting-started.en.mdx') },
};

export function loadContent(section: Section, slug: string, locale: string): Promise<ContentModule> | null {
  const entry = loaders[`${section}/${slug}`];
  if (!entry) return null;
  return entry[locale === 'en' ? 'en' : 'mn']();
}

export async function listContent(section: Section, locale: string) {
  const slugs = section === 'customs' ? CUSTOMS : GUIDES;
  return Promise.all(slugs.map(async (slug) => ({ slug, meta: (await (loadContent(section, slug, locale) as Promise<ContentModule>)).meta })));
}
