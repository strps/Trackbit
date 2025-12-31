import {
    gradientToCSSOrdered,
    mapValueToColorOrdered,
} from "@/lib/colorUtils";
import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RgbaColorPicker } from "react-colorful";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { CollapsibleSection } from "./Collapsible";
import { bigButtonClassName, bigButtonSelectedClassName } from "@/components/BigButton";
import { ColorStop } from "@trackbit/types";

interface GradientPickerProps {
    value: ColorStop[];
    onChange?: (stops: ColorStop[]) => void;
}

export function GradientPicker({ value, onChange }: GradientPickerProps) {

    const gradientRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);


    const updateStops = (newStops: ColorStop[]) => {
        onChange?.(newStops)
    };

    const [selected, setSelected] = useState<number | null>(null);
    const [dragging, setDragging] = useState<number | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null) {
                if (value.length > 2) {
                    const newStops = value.filter((_, i) => i !== selected);
                    updateStops(newStops);
                    setSelected(null);
                }
            }
        };

        const container = containerRef.current;
        container?.addEventListener('keydown', handleKeyDown);
        return () => container?.removeEventListener('keydown', handleKeyDown);
    }, [selected, value]);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
        e.stopPropagation();
        e.preventDefault();

        setSelected(index);
        setDragging(index);

        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (dragging === null || !gradientRef.current) return;

        const rect = gradientRef.current.getBoundingClientRect();
        let relativeValue = (e.clientX - rect.left) / rect.width;
        relativeValue = Math.max(0, Math.min(relativeValue, 1));

        const newStops = value.map((stop, idx) => {
            if (idx === dragging) {
                return { ...stop, position: relativeValue };
            }
            return stop;
        });

        updateStops(newStops);
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        setDragging(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const handleAddStop = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!gradientRef.current) return;
        const rect = gradientRef.current.getBoundingClientRect();
        const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

        const color = mapValueToColorOrdered(position, 0, 1, value);
        const colorWithAlpha = color.length === 3 ? [...color, 1] : color;
        const newStops = [...value, { position, color: colorWithAlpha }] as ColorStop[];
        updateStops(newStops);
        setSelected(newStops.length - 1);
    };

    const onColorChange = (newColor: { r: number, g: number, b: number, a: number }) => {
        if (selected === null) return;
        const newStops = value.map((stop, idx) => {
            if (idx === selected) {
                return { ...stop, color: [newColor.r, newColor.g, newColor.b, newColor.a] as [number, number, number, number] };
            }
            return stop;
        });
        updateStops(newStops);
    };

    const onManualPositionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (selected === null) return;
        const val = Math.max(0, Math.min(100, Number(e.target.value))) / 100;

        const newStops = value.map((stop, idx) =>
            idx === selected ? { ...stop, position: val } : stop
        );
        updateStops(newStops);
    };

    const onRGBChange = (channel: number, val: string) => {
        if (selected === null) return;
        const numVal = Math.max(0, Math.min(channel === 3 ? 1 : 255, Number(val)));

        const newStops = value.map((stop, idx) => {
            if (idx === selected) {
                const newColor = [...stop.color] as [number, number, number, number];
                newColor[channel] = numVal;
                return { ...stop, color: newColor };
            }
            return stop;
        });
        updateStops(newStops);
    };

    const deleteSelected = () => {
        if (selected !== null && value.length > 2) {
            updateStops(value.filter((_, i) => i !== selected));
            setSelected(null);
        }
    };

    return (

        <div ref={containerRef} className="space-y-4 outline-none" tabIndex={0}>

            <div className="relative h-10 select-none">
                <div
                    ref={gradientRef}
                    onClick={handleAddStop}
                    style={{ backgroundImage: gradientToCSSOrdered(value) }}
                    className="w-full h-5 rounded-md relative cursor-crosshair shadow-inner border border-border top-2"
                >
                    {value.map((stop, idx) => (
                        <div
                            key={idx}
                            data-index={idx}
                            onPointerDown={(e) => onPointerDown(e, idx)}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onClick={(e) => { e.stopPropagation(); setSelected(idx); }}
                            style={{
                                left: `${stop.position * 100}%`,
                                backgroundColor: `rgb(${stop.color.join(",")})`,
                            }}
                            className={`
                                absolute top-1/2 -translate-x-1/2 -translate-y-1/2
                                w-4 h-6 rounded-sm border-2 shadow-md cursor-grab active:cursor-grabbing
                                transition-transform
                                ${selected === idx
                                    ? "border-blue-500 z-20 scale-110 ring-2 ring-blue-200"
                                    : "border-white z-10"}
                            `}
                        />
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-4 items-end p-4 bg-muted rounded-xl border border-border">

                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Picker</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                disabled={selected === null}
                                className="block w-12 h-10 rounded-md border border-border shadow-sm disabled:opacity-50 cursor-pointer"
                                style={{
                                    backgroundColor: selected !== null
                                        ? `rgb(${value[selected].color.join(",")})`
                                        : "#e2e8f0"
                                }}
                            />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3">
                            {selected !== null && (
                                <RgbaColorPicker
                                    color={{
                                        r: value[selected].color[0],
                                        g: value[selected].color[1],
                                        b: value[selected].color[2],
                                        a: value[selected].color[3] ?? 1
                                    }}
                                    onChange={onColorChange}
                                />
                            )}
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Pos %</Label>
                    <Input
                        type="number"
                        className="w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        onChange={onManualPositionChange}
                        value={selected !== null ? Math.round(value[selected].position * 100) : ""}
                        disabled={selected === null}
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">RGBA Values</Label>
                    <div className="flex gap-2">
                        {['R', 'G', 'B', 'A'].map((label, i) => (
                            <div key={label} className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">{label}</span>
                                <Input
                                    type="number"
                                    step={label === 'A' ? 0.1 : 1}
                                    className="w-16 pl-5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    value={selected !== null ? (value[selected].color[i] ?? (label === 'A' ? 1 : 0)) : ""}
                                    onChange={(e) => onRGBChange(i, e.target.value)}
                                    disabled={selected === null}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <Button
                    onClick={deleteSelected}
                    disabled={selected === null || value.length <= 2}
                    variant="ghost"
                    title="Delete Stop"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>

    );
}