import { createContext, useContext, useState } from 'react';
import type { UnitSystem } from '@/shared/utils/intlFormatter';

export type { UnitSystem };

const STORAGE_KEY = 'trackbit.unit_system';

interface UnitSystemContextValue {
    unitSystem: UnitSystem;
    setUnitSystem: (us: UnitSystem) => void;
}

const UnitSystemContext = createContext<UnitSystemContextValue>({
    unitSystem: 'metric',
    setUnitSystem: () => null,
});

export function UnitSystemProvider({ children }: { children: React.ReactNode }) {
    const [unitSystem, setUnitSystemState] = useState<UnitSystem>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'imperial' ? 'imperial' : 'metric';
    });

    const setUnitSystem = (us: UnitSystem) => {
        localStorage.setItem(STORAGE_KEY, us);
        setUnitSystemState(us);
    };

    return (
        <UnitSystemContext.Provider value={{ unitSystem, setUnitSystem }}>
            {children}
        </UnitSystemContext.Provider>
    );
}

export function useUnitSystem() {
    return useContext(UnitSystemContext);
}
