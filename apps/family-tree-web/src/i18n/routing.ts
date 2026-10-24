import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['mn', 'en'],
  defaultLocale: 'mn',
  // Mongolian is the product's language: "/" is always Mongolian, English lives under /en.
  localePrefix: 'as-needed',
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
