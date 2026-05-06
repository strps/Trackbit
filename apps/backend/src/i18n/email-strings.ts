import { t } from './index.js';

export interface VerificationStrings {
  preview: string;
  heading: string;
  greeting: string;
  body: string;
  button: string;
  linkPrompt: string;
  footer: string;
}

export interface PasswordResetStrings {
  preview: string;
  heading: string;
  greeting: string;
  body: string;
  button: string;
  linkPrompt: string;
  footer: string;
}

export interface TesterInvitationStrings {
  preview: string;
  heading: string;
  greeting: string;
  body1: string;
  body2: string;
  button: string;
  linkPrompt: string;
  footer: string;
}

export function buildVerificationStrings(
  locale: string,
  name: string,
): VerificationStrings {
  return {
    preview: t('emails', 'verification.preview', locale),
    heading: t('emails', 'verification.heading', locale),
    greeting: t('emails', 'verification.greeting', locale, { name }),
    body: t('emails', 'verification.body', locale),
    button: t('emails', 'verification.button', locale),
    linkPrompt: t('emails', 'verification.link_prompt', locale),
    footer: t('emails', 'verification.footer', locale),
  };
}

export function buildPasswordResetStrings(
  locale: string,
  name: string,
): PasswordResetStrings {
  return {
    preview: t('emails', 'password_reset.preview', locale),
    heading: t('emails', 'password_reset.heading', locale),
    greeting: t('emails', 'password_reset.greeting', locale, { name }),
    body: t('emails', 'password_reset.body', locale),
    button: t('emails', 'password_reset.button', locale),
    linkPrompt: t('emails', 'password_reset.link_prompt', locale),
    footer: t('emails', 'password_reset.footer', locale),
  };
}

export function buildTesterInvitationStrings(
  locale: string,
  name: string,
): TesterInvitationStrings {
  return {
    preview: t('emails', 'tester_invitation.preview', locale),
    heading: t('emails', 'tester_invitation.heading', locale),
    greeting: t('emails', 'tester_invitation.greeting', locale, { name }),
    body1: t('emails', 'tester_invitation.body1', locale),
    body2: t('emails', 'tester_invitation.body2', locale),
    button: t('emails', 'tester_invitation.button', locale),
    linkPrompt: t('emails', 'tester_invitation.link_prompt', locale),
    footer: t('emails', 'tester_invitation.footer', locale),
  };
}
