export type ApiErrorCode =
    | 'habit_frozen'
    | 'custom_exercise_frozen'
    | 'habit_limit_reached'
    | 'custom_exercise_limit_reached'
    | 'habit_type_not_allowed'
    | string;

export interface ApiErrorPayload {
    error: ApiErrorCode;
    message?: string;
    maxHabits?: number;
    maxCustomExercises?: number;
    allowedHabitTypes?: string[];
    habitId?: number;
    exerciseId?: number;
    frozenIds?: number[];
}

export class ApiError extends Error {
    status: number;
    code: ApiErrorCode;
    payload: ApiErrorPayload;

    constructor(status: number, payload: ApiErrorPayload) {
        super(payload.message ?? payload.error ?? `Request failed with status ${status}`);
        this.name = 'ApiError';
        this.status = status;
        this.code = payload.error;
        this.payload = payload;
    }
}

export async function parseApiError(res: Response, fallbackMessage: string): Promise<ApiError> {
    let payload: ApiErrorPayload;
    try {
        payload = await res.json();
    } catch {
        payload = { error: 'unknown', message: fallbackMessage };
    }
    return new ApiError(res.status, payload);
}
