import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import {
  getAnalyticsOverview,
  getPersonalRecords,
  getVolumeByMuscle,
  getCardioSummary,
  type AnalyticsOverview,
  type PersonalRecord,
  type MuscleVolume,
  type CardioSummary,
} from "@/lib/analytics-api";

const STALE = 5 * 60 * 1000;

export const analyticsOverviewKey = ["analytics", "overview"] as const;
export const analyticsVolumeKey = ["analytics", "volume-by-muscle"] as const;
export const analyticsPRsKey = ["analytics", "prs"] as const;
export const analyticsCardioKey = ["analytics", "cardio"] as const;

export function useAnalyticsOverview() {
  const { token } = useAuth();
  return useQuery<AnalyticsOverview, Error>({
    queryKey: analyticsOverviewKey,
    queryFn: () => getAnalyticsOverview(token!),
    enabled: token !== null,
    staleTime: STALE,
  });
}

export function usePersonalRecords() {
  const { token } = useAuth();
  return useQuery<PersonalRecord[], Error>({
    queryKey: analyticsPRsKey,
    queryFn: () => getPersonalRecords(token!),
    enabled: token !== null,
    staleTime: STALE,
  });
}

export function useVolumeByMuscle() {
  const { token } = useAuth();
  return useQuery<MuscleVolume[], Error>({
    queryKey: analyticsVolumeKey,
    queryFn: () => getVolumeByMuscle(token!),
    enabled: token !== null,
    staleTime: STALE,
  });
}

export function useCardioSummary() {
  const { token } = useAuth();
  return useQuery<CardioSummary, Error>({
    queryKey: analyticsCardioKey,
    queryFn: () => getCardioSummary(token!),
    enabled: token !== null,
    staleTime: STALE,
  });
}
