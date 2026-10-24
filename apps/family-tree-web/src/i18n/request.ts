import * as rootParams from 'next/root-params';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

// Reads the locale from the root [locale] segment (static-rendering friendly, Next ≥ 16.3).
export default getRequestConfig(async ({ locale }) => {
  let resolved = locale;
  if (!resolved) {
    const param = await rootParams.locale();
    resolved = hasLocale(routing.locales, param) ? param : routing.defaultLocale;
  }
  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
    timeZone: 'Asia/Ulaanbaatar',
  };
});
