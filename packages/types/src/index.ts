
export interface ColorStop {
    position: number;
    color: [number, number, number] | [number, number, number, number];
}

export interface Habit {
    id: number;
    userId: string;
    name: string;
    description: string | null;
    type: 'count' | 'complex' | 'negative' | 'timed' | 'check';
    isAntiHabit: boolean;
    colorTheme: 'green' | 'blue' | 'orange' | 'purple' | 'rose' | 'fire' | 'custom';
    colorStops: ColorStop[];
    icon: string;
    weeklyGoal: number;
    dailyGoal: number;
    order: number;
    createdAt: string | null;
    frozen?: boolean;
}

export interface Exercise {
    id: number;
    userId: string | null;
    name: string;
    category: string;
    muscleGroup: string | null;
    defaultWeightUnit: string | null;
    defaultDistanceUnit: string | null;
    createdAt: string | null;
    frozen?: boolean;
}

export interface ExerciseSession {
    id: number;
    dayLogId: number;
    createdAt: string | null;
}

export interface ExerciseLog {
    id: number;
    exerciseId: number;
    exerciseSessionId: number;
    createdAt: string | null;
    distance: number | null;
    duration: number | null;
    distanceUnit: string | null;
    weightUnit: string | null;
    // Provenance: the list item this log was logged from, when it came from a
    // source queue. Null for ad-hoc logs and for computed sources.
    listItemId: number | null;
}

export interface ExercisePerformance {
    id: number;
    number: number;
    exerciseLogId: number;
    reps: number | null;
    weight: number | null;
    duration: number | null;
    distance: number | null;
    createdAt: Date | string | null;
    rpe: number | null;
}
//========================================================
//------- Exercise lists & sources -------
//========================================================

// A prescription mirrors the nullable target columns on exercise_list_items 1:1.
// Every field is `T | null` (never optional) so "not prescribed" has exactly one
// representation across JSON round-trips.
export interface Prescription {
    targetSets: number | null;
    targetReps: number | null;
    targetWeight: number | null;
    targetDuration: number | null;   // seconds
    targetDistance: number | null;
    restSeconds: number | null;
    notes: string | null;
}

export interface ExerciseListItem extends Prescription {
    id: number;
    listId: number;
    exerciseId: number;
    position: number;
}

export interface ExerciseList {
    id: number;
    userId: string;
    // Set when someone else (e.g. a trainer) authored the list; equals userId for
    // self-made lists, null for lists created before authorship was tracked.
    authorId: string | null;
    name: string;
    description: string | null;
    position: number;
    createdAt: string | null;
    updatedAt: string | null;
    items?: ExerciseListItem[];
    frozen?: boolean;
}

// Identity of an exercise source. `null` (absence of a ref) is browse mode —
// the full catalog is deliberately NOT a source.
export type ExerciseSourceRef =
    | { kind: 'list'; listId: number }
    | { kind: 'program'; programId: number }
    | { kind: 'computed'; strategy: string };

// Canonical serialization: `list:12`, `program:3`, `computed:agent-v1`.
// This regex is the single definition of the key format; the backend builds its
// zod validator from it so both ends can never drift.
export const EXERCISE_SOURCE_KEY_PATTERN = /^(?:list|program):\d+$|^computed:[a-z0-9-]+$/;

export function serializeSourceKey(ref: ExerciseSourceRef): string {
    switch (ref.kind) {
        case 'list': return `list:${ref.listId}`;
        case 'program': return `program:${ref.programId}`;
        case 'computed': return `computed:${ref.strategy}`;
    }
}

// Returns null for anything unparseable — callers treat that as browse mode
// rather than an error, which is how dangling persisted refs recover.
export function parseSourceKey(key: string): ExerciseSourceRef | null {
    if (!EXERCISE_SOURCE_KEY_PATTERN.test(key)) return null;

    const separator = key.indexOf(':');
    const kind = key.slice(0, separator);
    const value = key.slice(separator + 1);

    switch (kind) {
        case 'list': return { kind: 'list', listId: Number(value) };
        case 'program': return { kind: 'program', programId: Number(value) };
        case 'computed': return { kind: 'computed', strategy: value };
        default: return null;
    }
}

// Derived at read time, never stored. This is what lets the picker branch on
// what a source can do instead of on what kind it is.
export interface SourceCapabilities {
    canAppend: boolean;    // show the "add this exercise to the source" affordance
    canReorder: boolean;
    prescribes: boolean;   // entries may carry prescriptions worth pre-filling
    isDynamic: boolean;    // content changes without user edits → short cache TTL
}

export interface ExerciseSourceDescriptor {
    ref: ExerciseSourceRef;
    key: string;               // canonical serialization
    name: string | null;       // user content, never translated; null ⇒ render nameKey
    nameKey?: string;          // i18n key for system-named sources
    itemCount: number | null;  // null when unknowable before resolution
    capabilities: SourceCapabilities;
    frozen: boolean;           // over-limit resource → read-only
}

export interface QueueEntry {
    exerciseId: number;              // client joins its own exercise cache
    position: number;
    listItemId: number | null;       // provenance; null for computed sources
    prescription: Prescription | null;
}

export type QueueEmptyReason = 'rest_day' | 'no_routine_scheduled' | 'list_empty' | 'no_data';

export interface ResolvedQueue {
    descriptor: ExerciseSourceDescriptor;
    entries: QueueEntry[];
    resolvedFrom?: {                 // program → which routine today resolved to
        listId: number;
        listName: string;
        programEntryId: number;
    };
    emptyReason?: QueueEmptyReason;
    generatedAt: string;             // ISO
    expiresAt?: string;              // computed sources only
}
