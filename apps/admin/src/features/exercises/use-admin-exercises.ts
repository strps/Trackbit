import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_URL = `${import.meta.env.VITE_API_URL}/admin/exercises`
const MG_URL = `${import.meta.env.VITE_API_URL}/admin/exercises/muscle-groups`

export interface I18nString {
    en: string
    es?: string | null
}

export interface I18nOptional {
    en?: string | null
    es?: string | null
}

export interface AdminExercise {
    id: number
    name: string
    nameI18n: I18nString | null
    category: 'strength' | 'cardio' | 'flexibility'
    descriptionI18n: I18nOptional | null
    defaultWeightUnit: string | null
    defaultDistanceUnit: string | null
    userId: string | null
    createdAt: string | null
    muscleGroups: { id: number; name: string }[]
}

export interface MuscleGroup {
    id: number
    name: string
    nameI18n: I18nString | null
    slug: string
    descriptionI18n: I18nOptional | null
    parentId: number | null
    parentName: string | null
    level: number
    displayOrder: number | null
    createdAt: string | null
}

export interface ExercisePayload {
    name: I18nString
    category: 'strength' | 'cardio' | 'flexibility'
    description?: I18nOptional | null
    defaultWeightUnit?: string | null
    defaultDistanceUnit?: string | null
    muscleGroups?: number[]
}

export interface MuscleGroupPayload {
    name: I18nString
    description?: I18nOptional | null
    parentId?: number | null
    displayOrder?: number
}

async function fetchExercises(): Promise<AdminExercise[]> {
    const res = await fetch(API_URL, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch exercises')
    return res.json()
}

async function fetchMuscleGroups(): Promise<MuscleGroup[]> {
    const res = await fetch(MG_URL, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch muscle groups')
    return res.json()
}

async function createExerciseFn(payload: ExercisePayload): Promise<AdminExercise> {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to create exercise')
    return res.json()
}

async function updateExerciseFn({ id, ...payload }: { id: number } & Partial<ExercisePayload>): Promise<AdminExercise> {
    const res = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to update exercise')
    return res.json()
}

async function deleteExerciseFn(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error('Failed to delete exercise')
}

async function createMuscleGroupFn(payload: MuscleGroupPayload): Promise<MuscleGroup> {
    const res = await fetch(MG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to create muscle group')
    return res.json()
}

async function updateMuscleGroupFn({ id, ...payload }: { id: number } & Partial<MuscleGroupPayload>): Promise<MuscleGroup> {
    const res = await fetch(`${MG_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to update muscle group')
    return res.json()
}

async function deleteMuscleGroupFn(id: number): Promise<void> {
    const res = await fetch(`${MG_URL}/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error('Failed to delete muscle group')
}

export function useAdminExercises() {
    const queryClient = useQueryClient()

    const exercisesQuery = useQuery({ queryKey: ['admin', 'exercises'], queryFn: fetchExercises })
    const muscleGroupsQuery = useQuery({ queryKey: ['admin', 'muscle-groups'], queryFn: fetchMuscleGroups })

    const invalidateExercises = () => queryClient.invalidateQueries({ queryKey: ['admin', 'exercises'] })
    const invalidateMG = () => queryClient.invalidateQueries({ queryKey: ['admin', 'muscle-groups'] })

    const createMutation    = useMutation({ mutationFn: createExerciseFn,    onSuccess: invalidateExercises })
    const updateMutation    = useMutation({ mutationFn: updateExerciseFn,    onSuccess: invalidateExercises })
    const deleteMutation    = useMutation({ mutationFn: deleteExerciseFn,    onSuccess: invalidateExercises })
    const createMGMutation  = useMutation({ mutationFn: createMuscleGroupFn, onSuccess: invalidateMG })
    const updateMGMutation  = useMutation({ mutationFn: updateMuscleGroupFn, onSuccess: invalidateMG })
    const deleteMGMutation  = useMutation({ mutationFn: deleteMuscleGroupFn, onSuccess: invalidateMG })

    return {
        exercises: exercisesQuery.data ?? [],
        muscleGroups: muscleGroupsQuery.data ?? [],
        isLoading: exercisesQuery.isLoading,
        isMGLoading: muscleGroupsQuery.isLoading,
        systemExercises: (exercisesQuery.data ?? []).filter((e) => e.userId === null),
        userExercises: (exercisesQuery.data ?? []).filter((e) => e.userId !== null),
        createExercise: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        updateExercise: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,
        deleteExercise: deleteMutation.mutate,
        isDeleting: deleteMutation.isPending,
        createMuscleGroup: createMGMutation.mutateAsync,
        isCreatingMG: createMGMutation.isPending,
        updateMuscleGroup: updateMGMutation.mutateAsync,
        isUpdatingMG: updateMGMutation.isPending,
        deleteMuscleGroup: deleteMGMutation.mutate,
        isDeletingMG: deleteMGMutation.isPending,
    }
}
