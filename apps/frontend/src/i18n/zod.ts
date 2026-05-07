import { z } from 'zod';
import i18n from './index';

z.setErrorMap((issue) => {
  switch (issue.code) {
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string')
        return { message: i18n.t('validation.too_short', { min: issue.minimum }) };
      break;
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string')
        return { message: i18n.t('validation.too_long', { max: issue.maximum }) };
      break;
    case z.ZodIssueCode.invalid_format:
      if (issue.format === 'email')
        return { message: i18n.t('validation.invalid_email') };
      break;
  }
  return null;
});
