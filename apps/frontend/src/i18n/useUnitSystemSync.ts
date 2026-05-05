import { useEffect } from 'react';
import { useSession } from '@/shared/lib/auth-client';
import { useUnitSystem } from '@/providers/unit-system-provider';
import type { UnitSystem } from '@/shared/utils/intlFormatter';

export function useUnitSystemSync() {
    const { data: session } = useSession();
    const { unitSystem, setUnitSystem } = useUnitSystem();
    const sessionUnit = (session?.user as any)?.unitSystem as UnitSystem | undefined;

    useEffect(() => {
        if (sessionUnit && sessionUnit !== unitSystem) {
            setUnitSystem(sessionUnit);
        }
    }, [sessionUnit]);
}
