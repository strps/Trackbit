import { createContext, useContext, useState } from 'react';

export type ExerciseCardStyle = 'classic' | 'compact';

const STORAGE_KEY = 'trackbit.exercise_card_style';

interface ExerciseCardStyleContextValue {
    cardStyle: ExerciseCardStyle;
    setCardStyle: (style: ExerciseCardStyle) => void;
}

const ExerciseCardStyleContext = createContext<ExerciseCardStyleContextValue>({
    cardStyle: 'classic',
    setCardStyle: () => null,
});

export function ExerciseCardStyleProvider({ children }: { children: React.ReactNode }) {
    const [cardStyle, setCardStyleState] = useState<ExerciseCardStyle>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'compact' ? 'compact' : 'classic';
    });

    const setCardStyle = (style: ExerciseCardStyle) => {
        localStorage.setItem(STORAGE_KEY, style);
        setCardStyleState(style);
    };

    return (
        <ExerciseCardStyleContext.Provider value={{ cardStyle, setCardStyle }}>
            {children}
        </ExerciseCardStyleContext.Provider>
    );
}

export function useExerciseCardStyle() {
    return useContext(ExerciseCardStyleContext);
}
