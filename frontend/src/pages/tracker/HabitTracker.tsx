import { useMemo } from 'react';
import {
  Flame, Trophy, Activity, Dumbbell,
  Book as MenuBook, Code, Star, Droplet
} from 'lucide-react';
import { useHabitLogs } from '@/hooks/use-habit-logs';
import { formatDate, getCalendarDates } from './utils';
import { Heatmap } from './Heatmap';
import { Stats } from './Stats';
import { DayLog } from './DetailsPanel';
import { mapValueToColor, mapValueToCSSrgb } from '@/lib/colorUtils';
import { Button } from '@/components/ui/button';
import { ColorStop } from 'trackbit-types';


// Helper function to map habit icon string to Lucide component
const getHabitIcon = (iconName: string): React.ElementType => {
  switch (iconName) {
    case 'dumbbell': return Dumbbell;
    case 'code': return Code;
    case 'book': return MenuBook;
    case 'star': return Star;
    case 'water': return Droplet;
    case 'alert': return Trophy; // Placeholder for negative
    default: return Activity;
  }
};

const HabitTracker = () => {

  const { habitsWithLogs, isLoading, setDay: setSelectedDay, selectedHabitId, currentHabit, setHabitId } = useHabitLogs();

  const todayStr = formatDate(new Date());


  const logsMap = currentHabit?.dayLogs;

  const calendarDates = useMemo(() => getCalendarDates(), []);
  const weeks = useMemo(() => {
    const w: Date[][] = [];
    let currentWeek: Date[] = [];
    calendarDates.forEach((date) => {
      currentWeek.push(date);
      if (currentWeek.length === 7) { w.push(currentWeek); currentWeek = []; }
    });
    return w;
  }, [calendarDates]);

  if (isLoading) return <div className="p-8 text-center">Loading Tracker Data...</div>;

  if (Object.keys(habitsWithLogs).length === 0) return (
    <div className="flex h-screen items-center justify-center flex-col gap-4">
      <div className="p-6 bg-slate-100 rounded-full"><Dumbbell className="w-8 h-8 text-slate-400" /></div>
      <p className="text-slate-500">No habits found. Go to Settings to create one!</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header & Habit Selector */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Flame className="w-8 h-8 text-orange-500 fill-orange-500" />
            Momentum
          </h1>
          <div className="flex overflow-x-auto gap-2 pb-2">
            {Object.keys(habitsWithLogs).map((id: any) => {
              const IconComponent = getHabitIcon(habitsWithLogs[id].icon);
              return (
                <Button
                  key={id}
                  onClick={() => { setHabitId(id); setSelectedDay(formatDate(new Date())) }}
                  style={{ backgroundColor: getColorAtOne(habitsWithLogs[id].colorStops) }}

                >
                  <IconComponent className="w-4 h-4" />
                  {habitsWithLogs[id].name}
                </Button>
              );
            })}
          </div>
        </div>

        <Stats />

        <Heatmap
          weeks={weeks}
          todayStr={todayStr}
        />

        <DayLog
        />
      </div>
    </div>
  );
};

export default HabitTracker;

const getColorAtOne = (colorStops: ColorStop[]) => {
  const [r, g, b] = mapValueToColor(1, 0, 1, colorStops);
  //TODO: return text color in order to make sure it has enough contrast
  return `rgb(${r}, ${g}, ${b})`;
}