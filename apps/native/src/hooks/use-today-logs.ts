import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTodayLogs } from "@/lib/habits-api";
import { useAuth } from "@/context/auth-context";

// This key always holds a Map<habitId, rating> — set manually, never by a queryFn.
export const todayRatingsKey = ["today-ratings"] as const;

export function useTodayLogs() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["today-logs-fetch"] as const,
    queryFn: async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const logs = await getTodayLogs(token!, tz);
      // Populate the ratings map that useHabits reads via getQueryData.
      queryClient.setQueryData<Map<number, number>>(
        todayRatingsKey,
        new Map(logs.map((l) => [l.habitId, l.rating])),
      );
      return logs;
    },
    enabled: token !== null,
    staleTime: 1000 * 60 * 5,
  });
}
