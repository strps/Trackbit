export type UnitSystem = 'metric' | 'imperial';

const KG_TO_LBS = 2.20462;

export function kgToDisplay(kg: number, unitSystem: UnitSystem): number {
    if (unitSystem === 'imperial') {
        // Round to nearest 0.5 lbs for practical display
        return Math.round(kg * KG_TO_LBS * 2) / 2;
    }
    return kg;
}

export function displayToKg(value: number, unitSystem: UnitSystem): number {
    if (unitSystem === 'imperial') {
        return Math.round((value / KG_TO_LBS) * 100) / 100;
    }
    return value;
}

export function weightUnit(unitSystem: UnitSystem): string {
    return unitSystem === 'imperial' ? 'lbs' : 'kg';
}

export function formatNumber(value: number, locale: string, opts?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(locale, opts).format(value);
}

export function formatWeight(kg: number, unitSystem: UnitSystem, locale: string): string {
    const display = kgToDisplay(kg, unitSystem);
    const unit = weightUnit(unitSystem);
    return `${formatNumber(display, locale)} ${unit}`;
}
