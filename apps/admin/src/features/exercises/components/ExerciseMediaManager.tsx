import { useRef, useState, type DragEvent } from "react";
import { GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
    EXERCISE_MEDIA_MAX_BYTES,
    EXERCISE_MEDIA_MAX_PER_EXERCISE,
    EXERCISE_MEDIA_TYPES,
    type ExerciseMediaType,
} from "@trackbit/types";
import { Badge, Button, Input, Label } from "@trackbit/ui";

import { readImageInfo } from "@/lib/image-info";
import { AdminExerciseMedia, I18nOptional, useAdminExercises, useExerciseMedia } from "../use-admin-exercises";

const isMediaType = (type: string): type is ExerciseMediaType => (EXERCISE_MEDIA_TYPES as readonly string[]).includes(type);

/**
 * A system exercise's images: upload, drag to reorder (the first is the cover), alt text, delete.
 * Each change is saved right away, apart from the exercise form.
 */
export function ExerciseMediaManager({ exerciseId }: { exerciseId: number }) {
    const { exercises } = useAdminExercises();
    const { upload, isUploading, reorder, updateAlt, remove, isBusy } = useExerciseMedia();
    const media = exercises.find((e) => e.id === exerciseId)?.media ?? [];
    const fileInput = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragged, setDragged] = useState<string | null>(null);
    // The order just dropped, shown until the list reloads with it.
    const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);

    const shown = pendingOrder
        ? pendingOrder.map((uuid) => media.find((m) => m.uuid === uuid)).filter((m): m is AdminExerciseMedia => !!m)
        : media;
    const full = media.length >= EXERCISE_MEDIA_MAX_PER_EXERCISE;

    const run = async (action: () => Promise<unknown>) => {
        setError(null);
        try {
            await action();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        }
    };

    const onFiles = (files: FileList | null) => run(async () => {
        const chosen = Array.from(files ?? []).slice(0, EXERCISE_MEDIA_MAX_PER_EXERCISE - media.length);
        for (const file of chosen) {
            if (!isMediaType(file.type)) throw new Error(`${file.name}: only WebP, JPEG and PNG images.`);
            if (file.size > EXERCISE_MEDIA_MAX_BYTES) throw new Error(`${file.name}: larger than 2 MB.`);
            const info = await readImageInfo(file);
            await upload({ exerciseId, file, contentType: file.type, ...info });
        }
    }).finally(() => {
        if (fileInput.current) fileInput.current.value = "";
    });

    const onDrop = (target: string) => (e: DragEvent) => {
        e.preventDefault();
        if (!dragged || dragged === target) return;
        const order = shown.map((m) => m.uuid).filter((uuid) => uuid !== dragged);
        order.splice(order.indexOf(target), 0, dragged);
        setDragged(null);
        setPendingOrder(order);
        run(() => reorder({ exerciseId, uuids: order })).finally(() => setPendingOrder(null));
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <Label>Images</Label>
                    <p className="text-xs text-muted-foreground">
                        WebP (static or animated), JPEG or PNG, up to 2 MB, at most {EXERCISE_MEDIA_MAX_PER_EXERCISE}.
                        The first is the cover; drag to reorder.
                    </p>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={full || isBusy}
                    onClick={() => fileInput.current?.click()}>
                    {isUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />}
                    Add images
                </Button>
                <input ref={fileInput} type="file" accept={EXERCISE_MEDIA_TYPES.join(",")} multiple hidden
                    onChange={(e) => onFiles(e.target.files)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {shown.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No images yet.</p>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {shown.map((image, i) => (
                        <li
                            key={image.uuid}
                            draggable={!isBusy}
                            onDragStart={() => setDragged(image.uuid)}
                            onDragEnd={() => setDragged(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={onDrop(image.uuid)}
                            className={`rounded-md border p-2 space-y-2 bg-background ${dragged === image.uuid ? "opacity-50" : ""}`}
                        >
                            <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                                {i === 0 && <Badge variant="secondary">Cover</Badge>}
                                {image.animated && <Badge variant="outline">Animated</Badge>}
                                <span className="text-xs text-muted-foreground">
                                    {image.width}×{image.height} · {Math.round(image.bytes / 1024)} KB
                                </span>
                                <Button type="button" variant="ghost" size="icon" className="ml-auto h-7 w-7" disabled={isBusy}
                                    aria-label="Delete image" onClick={() => run(() => remove({ exerciseId, uuid: image.uuid }))}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <img src={image.url} alt={image.altI18n?.en ?? ""} width={image.width} height={image.height}
                                loading="lazy" draggable={false} className="h-40 w-full rounded bg-muted object-contain" />
                            <AltInputs image={image}
                                onSave={(alt) => run(() => updateAlt({ exerciseId, uuid: image.uuid, alt }))} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** The image's alt text in English and Spanish, saved when a field loses focus with a change. */
function AltInputs({ image, onSave }: { image: AdminExerciseMedia; onSave: (alt: I18nOptional) => void }) {
    const [alt, setAlt] = useState({ en: image.altI18n?.en ?? "", es: image.altI18n?.es ?? "" });
    const save = () => {
        if (alt.en !== (image.altI18n?.en ?? "") || alt.es !== (image.altI18n?.es ?? "")) onSave(alt);
    };
    return (
        <div className="grid grid-cols-2 gap-2">
            {(["en", "es"] as const).map((locale) => (
                <Input key={locale} value={alt[locale]} maxLength={200} onBlur={save}
                    placeholder={locale === "en" ? "Alt text (English)" : "Alt text (Spanish)"}
                    aria-label={locale === "en" ? "Alt text (English)" : "Alt text (Spanish)"}
                    onChange={(e) => setAlt({ ...alt, [locale]: e.target.value })} />
            ))}
        </div>
    );
}
