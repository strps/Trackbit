import 'i18next';

import common from './locales/en/common.json';
import auth from './locales/en/auth.json';
import nav from './locales/en/nav.json';
import tracker from './locales/en/tracker.json';
import habits from './locales/en/habits.json';
import lists from './locales/en/lists.json';
import analytics from './locales/en/analytics.json';
import errors from './locales/en/errors.json';
import issues from './locales/en/issues.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    // Our JSON files use flat keys with literal dots (e.g. "sign_in.title").
    // keySeparator: false tells the type system to treat keys as literal strings
    // rather than splitting on '.' and walking nested paths.
    keySeparator: false;
    resources: {
      common: typeof common;
      auth: typeof auth;
      nav: typeof nav;
      tracker: typeof tracker;
      habits: typeof habits;
      lists: typeof lists;
      analytics: typeof analytics;
      errors: typeof errors;
      issues: typeof issues;
    };
  }
}
