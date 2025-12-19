export const formatDate = (date: Date) => date.toISOString().split('T')[0];

export const getIntensityColor = (value: number, baseColor = 'emerald') => {
    if (value === 0) return 'bg-slate-100 dark:bg-slate-800';
    const colors: Record<string, string[]> = {
        emerald: ['bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600', 'bg-emerald-800'],
        blue: ['bg-blue-200', 'bg-blue-400', 'bg-blue-600', 'bg-blue-800'],
        violet: ['bg-violet-200', 'bg-violet-400', 'bg-violet-600', 'bg-violet-800'],
        orange: ['bg-orange-200', 'bg-orange-400', 'bg-orange-600', 'bg-orange-800'],
        rose: ['bg-rose-200', 'bg-rose-400', 'bg-rose-600', 'bg-rose-800'],
        amber: ['bg-amber-200', 'bg-amber-400', 'bg-amber-600', 'bg-amber-800'],
        // Defaulting to a safe palette if custom color is missing
    };
    const palette = colors[baseColor] || colors.emerald;
    // Use Math.min(value, 4) to ensure we don't exceed the array length
    return palette[Math.min(value, 4) - 1] || palette[3];
};

export const getCalendarDates = () => {
    const dates = [];
    const today = new Date();
    // 53 weeks * 7 days
    const totalDays = 371;
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - today.getDay()));
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - totalDays + 1);

    let current = new Date(startDate);
    while (current <= endDate) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
};
