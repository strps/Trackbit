import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ICU from 'i18next-icu';

import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import enAuth from './locales/en/auth.json';
import esAuth from './locales/es/auth.json';
import enNav from './locales/en/nav.json';
import esNav from './locales/es/nav.json';
import enTracker from './locales/en/tracker.json';
import esTracker from './locales/es/tracker.json';
import enHabits from './locales/en/habits.json';
import esHabits from './locales/es/habits.json';
import enAnalytics from './locales/en/analytics.json';
import esAnalytics from './locales/es/analytics.json';
import enErrors from './locales/en/errors.json';
import esErrors from './locales/es/errors.json';
import enIssues from './locales/en/issues.json';
import esIssues from './locales/es/issues.json';

import type { Resource } from 'i18next';
import { isPseudoEnabled, PSEUDO_LOCALE, pseudoizeBundle } from './pseudo';

const enResources = {
  common: enCommon,
  auth: enAuth,
  nav: enNav,
  tracker: enTracker,
  habits: enHabits,
  analytics: enAnalytics,
  errors: enErrors,
  issues: enIssues,
};

const resources: Resource = {
  en: enResources,
  es: {
    common: esCommon,
    auth: esAuth,
    nav: esNav,
    tracker: esTracker,
    habits: esHabits,
    analytics: esAnalytics,
    errors: esErrors,
    issues: esIssues,
  },
};

const supportedLngs: string[] = ['en', 'es'];

if (isPseudoEnabled()) {
  resources[PSEUDO_LOCALE] = Object.fromEntries(
    Object.entries(enResources).map(([ns, bundle]) => [
      ns,
      pseudoizeBundle(bundle as Record<string, string>),
    ]),
  );
  supportedLngs.push(PSEUDO_LOCALE);
}

i18n
  .use(ICU)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs,
    fallbackLng: 'en',
    defaultNS: 'common',
    resources,
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'trackbit.lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

// Strip ?lang= from URL after detection — one-shot override, must not survive navigation
const url = new URL(window.location.href);
if (url.searchParams.has('lang')) {
  url.searchParams.delete('lang');
  window.history.replaceState({}, '', url.toString());
}

export default i18n;
