import { apiFetch } from "./api";

export type AnalyticsOverview = {
  totalSessions: number;
  totalStrengthVolume: number;
  sessionsByCategory: { strength: number; cardio: number; flexibility: number };
};

export type ExerciseProgress = {
  date: string;
  maxWeight: number;
  avgReps: number;
  sessionVolume: number;
  estimated1RM: number;
};

export type PersonalRecord = {
  exerciseName: string;
  weight: number;
  reps: number | null;
  tonnage: number;
  estimated1RM: number;
  date: string;
};

export type MuscleVolume = {
  muscleGroup: string;
  totalVolume: number;
};

export type CardioSummary = {
  totalDistance: number;
  totalDurationSeconds: number;
  averagePace: number;
};

export type DateRangeParams = { startDate?: string; endDate?: string };

function dateQuery(params?: DateRangeParams): string {
  const qs = new URLSearchParams();
  if (params?.startDate) qs.set("startDate", params.startDate);
  if (params?.endDate) qs.set("endDate", params.endDate);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function getAnalyticsOverview(token: string, params?: DateRangeParams): Promise<AnalyticsOverview> {
  return apiFetch<AnalyticsOverview>(`/api/analytics/overview${dateQuery(params)}`, { token });
}

export function getExerciseProgress(token: string, exerciseId: number, params?: DateRangeParams): Promise<ExerciseProgress[]> {
  return apiFetch<ExerciseProgress[]>(`/api/analytics/progress/${exerciseId}${dateQuery(params)}`, { token });
}

export function getPersonalRecords(token: string, limit = 10): Promise<PersonalRecord[]> {
  return apiFetch<PersonalRecord[]>(`/api/analytics/prs?limit=${limit}`, { token });
}

export function getVolumeByMuscle(token: string, params?: DateRangeParams): Promise<MuscleVolume[]> {
  return apiFetch<MuscleVolume[]>(`/api/analytics/volume-by-muscle${dateQuery(params)}`, { token });
}

export function getCardioSummary(token: string, params?: DateRangeParams): Promise<CardioSummary> {
  return apiFetch<CardioSummary>(`/api/analytics/cardio${dateQuery(params)}`, { token });
}
