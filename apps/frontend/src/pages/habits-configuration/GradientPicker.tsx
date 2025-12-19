import {
    gradientToCSSOrdered,
    mapValueToColorOrdered,
} from "@/lib/colorUtils";
import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RgbColorPicker } from "react-colorful";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { CollapsibleSection } from "../../components/Collapsible";
import { bigButtonSelectedClassName } from "@/components/BigButton";
import { ColorStop } from "@trackbit/types";

interface GradientPickerProps {
    value?: ColorStop[];
    onChange?: (stops: ColorStop[]) => void;
    isActive?: boolean;
    onClick?: () => void;
}

export function GradientPicker({ value, onChange, isActive, onClick }: GradientPickerProps) {

    const gradientRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [localStops, setLocalStops] = useState<ColorStop[]>([
        { position: 0, color: [255, 0, 0] },
        { position: 0.5, color: [255, 225, 0] },
        { position: 1, color: [12, 148, 62] }
    ]);

    useEffect(() => {
        if (onChange) onChange(localStops);
    }, [isActive]);

    const stops = value || localStops;

    const updateStops = (newStops: ColorStop[]) => {
        if (!value) setLocalStops(newStops);
        if (isActive) onChange?.(newStops)
    };

    const [selected, setSelected] = useState<number | null>(null);
    const [dragging, setDragging] = useState<number | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null) {
                if (stops.length > 2) {
                    const newStops = stops.filter((_, i) => i !== selected);
                    updateStops(newStops);
                    setSelected(null);
                }
            }
        };

        const container = containerRef.current;
        container?.addEventListener('keydown', handleKeyDown);
        return () => container?.removeEventListener('keydown', handleKeyDown);
    }, [selected, stops]);

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

        const newStops = stops.map((stop, idx) => {
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

        const color = mapValueToColorOrdered(position, 0, 1, stops);

        const newStops = [...stops, { position, color }];
        updateStops(newStops);
        setSelected(newStops.length - 1);
    };

    const onColorChange = (newColor: { r: number, g: number, b: number }) => {
        if (selected === null) return;
        const newStops = stops.map((stop, idx) => {
            if (idx === selected) {
                return { ...stop, color: [newColor.r, newColor.g, newColor.b] as [number, number, number] };
            }
            return stop;
        });
        updateStops(newStops);
    };

    const onManualPositionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (selected === null) return;
        const val = Math.max(0, Math.min(100, Number(e.target.value))) / 100;

        const newStops = stops.map((stop, idx) =>
            idx === selected ? { ...stop, position: val } : stop
        );
        updateStops(newStops);
    };

    const onRGBChange = (channel: number, val: string) => {
        if (selected === null) return;
        const numVal = Math.max(0, Math.min(255, Number(val)));

        const newStops = stops.map((stop, idx) => {
            if (idx === selected) {
                const newColor = [...stop.color] as [number, number, number];
                newColor[channel] = numVal;
                return { ...stop, color: newColor };
            }
            return stop;
        });
        updateStops(newStops);
    };

    const deleteSelected = () => {
        if (selected !== null && stops.length > 2) {
            updateStops(stops.filter((_, i) => i !== selected));
            setSelected(null);
        }
    };

    return (
        <CollapsibleSection
            className={`col-span-2 ${isActive && bigButtonSelectedClassName}`}
            isOpen={isActive}
            headerContent={
                <div
                    onClick={onClick}
                    className="col-span-2 w-full relative flex flex-col gap-2 items-center p-4 transition-all "
                >
                    <div className="flex gap-2">
                        <div style={{
                            backgroundColor: `rgb(${mapValueToColorOrdered(0, 0, 1, stops).join(", ")})`,
                            width: 20,
                            height: 20,
                            borderRadius: '25%',
                        }} />
                        <div style={{
                            backgroundColor: `rgb(${mapValueToColorOrdered(0.25, 0, 1, stops).join(", ")})`,
                            width: 20,
                            height: 20,
                            borderRadius: '25%',
                        }} />
                        <div style={{
                            backgroundColor: `rgb(${mapValueToColorOrdered(0.50, 0, 1, stops).join(", ")})`,
                            width: 20,
                            height: 20,
                            borderRadius: '25%',
                        }} />
                        <div style={{
                            backgroundColor: `rgb(${mapValueToColorOrdered(0.75, 0, 1, stops).join(", ")})`,
                            width: 20,
                            height: 20,
                            borderRadius: '25%',
                        }} />
                        <div style={{
                            backgroundColor: `rgb(${mapValueToColorOrdered(1, 0, 1, stops).join(", ")})`,
                            width: 20,
                            height: 20,
                            borderRadius: '25%',
                        }} />
                    </div>

                    <div className="text-left">
                        <span className={`block text-sm font-bold`}>
                            Custom Theme
                        </span>
                    </div>
                </div>
            }
        >
            <div ref={containerRef} className="space-y-4 outline-none" tabIndex={0}>

                <div className="relative h-10 select-none">
                    <div
                        ref={gradientRef}
                        onClick={handleAddStop}
                        style={{ backgroundImage: gradientToCSSOrdered(stops) }}
                        className="w-full h-5 rounded-md relative cursor-crosshair shadow-inner border border-border top-2"
                    >
                        {stops.map((stop, idx) => (
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
                                            ? `rgb(${stops[selected].color.join(",")})`
                                            : "#e2e8f0"
                                    }}
                                />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-3">
                                {selected !== null && (
                                    <RgbColorPicker
                                        color={{
                                            r: stops[selected].color[0],
                                            g: stops[selected].color[1],
                                            b: stops[selected].color[2]
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
                            value={selected !== null ? Math.round(stops[selected].position * 100) : ""}
                            disabled={selected === null}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">RGB Values</Label>
                        <div className="flex gap-2">
                            {['R', 'G', 'B'].map((label, i) => (
                                <div key={label} className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">{label}</span>
                                    <Input
                                        type="number"
                                        className="w-16 pl-5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={selected !== null ? stops[selected].color[i] : ""}
                                        onChange={(e) => onRGBChange(i, e.target.value)}
                                        disabled={selected === null}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button
                        onClick={deleteSelected}
                        disabled={selected === null || stops.length <= 2}
                        variant="ghost"
                        title="Delete Stop"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

        </CollapsibleSection>
    );
}