import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const RPE_LEVEL_KEYS = [
    'rpe_level_1',
    'rpe_level_2',
    'rpe_level_3',
    'rpe_level_4',
    'rpe_level_5',
    'rpe_level_6',
    'rpe_level_7',
    'rpe_level_8',
    'rpe_level_9',
    'rpe_level_10',
] as const;

/** The name of an RPE level (1–10), e.g. "Hard". */
export const useRpeLabel = () => {
    const { t } = useTranslation('tracker');
    return useCallback((level: number) => t(RPE_LEVEL_KEYS[level - 1]), [t]);
};
