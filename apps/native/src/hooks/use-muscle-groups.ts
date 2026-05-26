import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { getMuscleGroups, type MuscleGroup } from "@/lib/tracker-api";

export const muscleGroupsKey = ["muscle-groups"] as const;

export function useMuscleGroups() {
  const { token } = useAuth();

  return useQuery<MuscleGroup[]>({
    queryKey: muscleGroupsKey,
    queryFn: () => getMuscleGroups(token!),
    enabled: token !== null,
    staleTime: Infinity,
  });
}
