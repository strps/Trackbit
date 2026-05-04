import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ICU from 'i18next-icu';

import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';

i18n
  .use(ICU)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['en', 'es'],
    fallbackLng: 'en',
    defaultNS: 'common',
    resources: {
      en: { common: enCommon },
      es: { common: esCommon },
    },
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
