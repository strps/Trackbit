import { useEffect } from 'react';
import { useSession } from '@/shared/lib/auth-client';
import i18n from './index';

export function useLocaleSync() {
  const { data: session } = useSession();
  const sessionLocale = session?.user?.locale;

  useEffect(() => {
    if (sessionLocale && sessionLocale !== i18n.language) {
      i18n.changeLanguage(sessionLocale);
    }
  }, [sessionLocale]);
}
