import i18next from 'i18next';
import enErrors from './locales/en/errors.json';
import esErrors from './locales/es/errors.json';
import enEmails from './locales/en/emails.json';
import esEmails from './locales/es/emails.json';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { errors: enErrors, emails: enEmails },
    es: { errors: esErrors, emails: esEmails },
  },
});

export function t(
  ns: 'errors' | 'emails',
  key: string,
  locale: string,
  vars?: Record<string, string | number>,
): string {
  return i18next.t(key, { lng: locale, ns, ...vars }) as string;
}

export function negotiateFromHeader(header: string | undefined): SupportedLocale {
  if (!header) return 'en';
  const tags = header
    .split(',')
    .map((s) => s.split(';')[0].trim().slice(0, 2).toLowerCase());
  return (
    (tags.find((tag) =>
      (SUPPORTED_LOCALES as readonly string[]).includes(tag),
    ) as SupportedLocale) ?? 'en'
  );
}
