// src/pages/AnalyticsPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartConfig } from '@/components/ui/chart';
import { useExercises } from '../hooks/use-exercises';
import { Calendar } from '@/components/Calendar';

const API_URL = import.meta.env.VITE_API_URL;

const defaultEndDate = format(new Date(), 'yyyy-MM-dd');
const defaultStartDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');

export default function AnalyticsPage() {
    const [startDate, setStartDate] = useState(defaultStartDate);
    const [endDate, setEndDate] = useState(defaultEndDate);
    const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');

    const { exercises } = useExercises();

    const params = `?startDate=${startDate}&endDate=${endDate}`;

    const { data: overview } = useQuery({
        queryKey: ['analytics-overview', startDate, endDate],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/analytics/overview${params}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch overview');
            return res.json();
        },
    });

    const { data: progress = [] } = useQuery({
        queryKey: ['analytics-progress', selectedExerciseId, startDate, endDate],
        queryFn: async () => {
            if (!selectedExerciseId) return [];
            const res = await fetch(`${API_URL}/analytics/progress/${selectedExerciseId}${params}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch progress');
            return res.json();
        },
        enabled: !!selectedExerciseId,
    });

    const { data: prs = [] } = useQuery({
        queryKey: ['analytics-prs'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/analytics/prs`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch PRs');
            return res.json();
        },
    });

    const { data: muscleVolume = [] } = useQuery({
        queryKey: ['analytics-muscle-volume', startDate, endDate],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/analytics/volume-by-muscle${params}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch muscle volume');
            return res.json();
        },
    });

    const { data: cardio } = useQuery({
        queryKey: ['analytics-cardio', startDate, endDate],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/analytics/cardio${params}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch cardio');
            return res.json();
        },
    });

    // Chart configurations for shadcn/ui
    const progressConfig: ChartConfig = {
        maxWeight: { label: 'Max Weight (kg)', color: 'hsl(var(--chart-1))' },
        estimated1RM: { label: 'Estimated 1RM (kg)', color: 'hsl(var(--chart-2))' },
    };

    const muscleConfig: ChartConfig = {
        totalVolume: { label: 'Volume (kg)', color: 'hsl(var(--chart-3))' },
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-12">
            <div>
                <h1 className="text-4xl font-bold">Workout Analytics</h1>
                <p className="text-muted-foreground mt-2">Track your progress and performance over time</p>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Total Sessions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{overview?.totalSessions ?? 0}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Strength Volume</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{overview?.totalStrengthVolume?.toLocaleString() ?? 0} kg</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Cardio Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <p>Total Distance: {(cardio?.totalDistance ?? 0).toFixed(1)} km</p>
                        <p>Total Duration: {((cardio?.totalDurationSeconds ?? 0) / 3600).toFixed(1)} hours</p>
                    </CardContent>
                </Card>
            </div>

            {/* Date Range Selector */}
            <Card>
                <CardHeader>
                    <CardTitle>Date Range</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4 items-end">
                    <div className="grid gap-2">
                        <Label htmlFor="start">Start Date</Label>
                        <input
                            id="start"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 border rounded-md"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="end">End Date</Label>
                        <input
                            id="end"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 border rounded-md"
                        />
                    </div>
                    <Calendar label="Start Date" />
                    <Calendar label="End Date" />
                </CardContent>
            </Card>



            {/* Exercise Progress */}
            <Card>
                <CardHeader>
                    <CardTitle>Exercise Progress</CardTitle>
                    <CardDescription>Select an exercise to view progression over time</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="w-full max-w-sm">
                        <Label htmlFor="exercise">Exercise</Label>
                        <Select value={selectedExerciseId} onValueChange={setSelectedExerciseId}>
                            <SelectTrigger id="exercise">
                                <SelectValue placeholder="Select an exercise" />
                            </SelectTrigger>
                            <SelectContent>
                                {exercises.map((ex) => (
                                    <SelectItem key={ex.id} value={String(ex.id)}>
                                        {ex.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedExerciseId && progress.length > 0 && (
                        <ChartContainer config={progressConfig} className="">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={progress} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="maxWeight"
                                        stroke="var(--chart-1"
                                        name="Max Weight (kg)"
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="estimated1RM"
                                        stroke="var(--chart-2"
                                        name="Estimated 1RM (kg)"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* Muscle Group Volume */}
            <Card>
                <CardHeader>
                    <CardTitle>Muscle Group Volume</CardTitle>
                    <CardDescription>Total lifting volume by primary muscle group</CardDescription>
                </CardHeader>
                <CardContent>
                    {muscleVolume.length > 0 ? (
                        <ChartContainer config={muscleConfig} className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={muscleVolume}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="muscleGroup" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="totalVolume" fill="var(--color-totalVolume)" name="Volume (kg)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No volume data in selected period</p>
                    )}
                </CardContent>
            </Card>

            {/* Personal Records */}
            <Card>
                <CardHeader>
                    <CardTitle>Top Personal Records</CardTitle>
                    <CardDescription>Best estimated 1RM performances (strength exercises)</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full table-auto">
                            <thead>
                                <tr className="border-b text-left">
                                    <th className="pb-3">Exercise</th>
                                    <th className="pb-3">Weight (kg)</th>
                                    <th className="pb-3">Reps</th>
                                    <th className="pb-3">Est. 1RM (kg)</th>
                                    <th className="pb-3">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prs.length > 0 ? (
                                    prs.map((pr: any, i: number) => (
                                        <tr key={i} className="border-b">
                                            <td className="py-3">{pr.exerciseName}</td>
                                            <td className="py-3">{pr.weight}</td>
                                            <td className="py-3">{pr.reps}</td>
                                            <td className="py-3 font-medium">{pr.estimated1RM?.toFixed(0)}</td>
                                            <td className="py-3">{pr.date}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No personal records yet
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}