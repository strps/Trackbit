import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { put } from '@vercel/blob/client'
import type { ExerciseDifficulty, ExerciseEquipment, ExerciseMediaType } from '@trackbit/types'

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

/** Per-locale lists (instructions, tips, common mistakes); a locale without entries is absent. */
export interface I18nList {
    en?: string[]
    es?: string[]
}

export interface AdminExerciseMedia {
    uuid: string
    url: string
    mimeType: ExerciseMediaType
    animated: boolean
    width: number
    height: number
    bytes: number
    position: number
    altI18n: I18nOptional | null
}

export interface AdminExercise {
    id: number
    name: string
    nameI18n: I18nString | null
    category: 'strength' | 'cardio' | 'flexibility'
    descriptionI18n: I18nOptional | null
    instructionsI18n: I18nList | null
    tipsI18n: I18nList | null
    commonMistakesI18n: I18nList | null
    equipment: ExerciseEquipment[]
    difficulty: ExerciseDifficulty | null
    variantOfId: number | null
    defaultWeightUnit: string | null
    defaultDistanceUnit: string | null
    userId: string | null
    createdAt: string | null
    muscleGroups: { id: number; name: string }[]
    media: AdminExerciseMedia[]
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
    instructions?: I18nList | null
    tips?: I18nList | null
    commonMistakes?: I18nList | null
    equipment?: ExerciseEquipment[]
    difficulty?: ExerciseDifficulty | null
    variantOfId?: number | null
}

export interface MuscleGroupPayload {
    name: I18nString
    description?: I18nOptional | null
    parentId?: number | null
    displayOrder?: number
}

/** The API's own message for a failed [res], else [fallback]. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
    const body = await res.json().catch(() => null)
    return body?.message ?? body?.error ?? fallback
}

async function sendJson<T>(method: string, url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...(body !== undefined && { body: JSON.stringify(body) }),
    })
    if (!res.ok) throw new Error(await errorMessage(res, `Request failed (${res.status})`))
    return res.json()
}

// ─── Media ───────────────────────────────────────────────────────────────────

export interface MediaUpload {
    exerciseId: number
    file: File
    contentType: ExerciseMediaType
    width: number
    height: number
    animated: boolean
}

/** Uploads [file] straight to the media store with a token from the API, then records it. */
async function uploadMediaFn({ exerciseId, file, contentType, ...image }: MediaUpload): Promise<AdminExerciseMedia> {
    const base = `${API_URL}/${exerciseId}/media`
    const { key, token } = await sendJson<{ key: string; token: string }>('POST', `${base}/upload-token`, { contentType })
    await put(key, file, { access: 'public', token, contentType })
    return sendJson('POST', base, { key, ...image })
}

const reorderMediaFn = ({ exerciseId, uuids }: { exerciseId: number; uuids: string[] }) =>
    sendJson<AdminExerciseMedia[]>('PATCH', `${API_URL}/${exerciseId}/media/order`, { uuids })

const updateMediaAltFn = ({ exerciseId, uuid, alt }: { exerciseId: number; uuid: string; alt: I18nOptional | null }) =>
    sendJson<AdminExerciseMedia>('PATCH', `${API_URL}/${exerciseId}/media/${uuid}`, { alt })

const deleteMediaFn = ({ exerciseId, uuid }: { exerciseId: number; uuid: string }) =>
    sendJson<{ success: true }>('DELETE', `${API_URL}/${exerciseId}/media/${uuid}`)

/** An exercise's media writes; each refreshes the exercise list when it settles. */
export function useExerciseMedia() {
    const queryClient = useQueryClient()
    const onSettled = () => queryClient.invalidateQueries({ queryKey: ['admin', 'exercises'] })
    const upload = useMutation({ mutationFn: uploadMediaFn, onSettled })
    const reorder = useMutation({ mutationFn: reorderMediaFn, onSettled })
    const updateAlt = useMutation({ mutationFn: updateMediaAltFn, onSettled })
    const remove = useMutation({ mutationFn: deleteMediaFn, onSettled })
    return {
        upload: upload.mutateAsync,
        isUploading: upload.isPending,
        reorder: reorder.mutateAsync,
        updateAlt: updateAlt.mutateAsync,
        remove: remove.mutateAsync,
        isBusy: upload.isPending || reorder.isPending || remove.isPending,
    }
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
    if (!res.ok) throw new Error(await errorMessage(res, 'Failed to create exercise'))
    return res.json()
}

async function updateExerciseFn({ id, ...payload }: { id: number } & Partial<ExercisePayload>): Promise<AdminExercise> {
    const res = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await errorMessage(res, 'Failed to update exercise'))
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
