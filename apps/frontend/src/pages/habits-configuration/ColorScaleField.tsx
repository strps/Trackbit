import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { gradientToCSS, mapValueToColor, mapValueToCSSrgb } from '../../lib/colorUtils';
import { GradientPicker } from './GradientPicker';
import { BigButton } from '@/components/BigButton';
import { ColorStop } from "@trackbit/types";
import { InputProps } from '@/components/Fields/FieldBase';


type Preset = {
    label: string;
    stops: ColorStop[];
};


export const GRADIENT_PRESETS: Record<string, Preset> = {
    emerald: {
        label: "Growth (Green)",
        stops: [
            { position: 0, color: [241, 245, 249, 1] },   // slate-100
            { position: 0.4, color: [134, 239, 172, 1] }, // green-300
            { position: 1, color: [21, 128, 61, 1] }      // green-700
        ]
    },
    blue: {
        label: "Focus (Blue)",
        stops: [
            { position: 0, color: [241, 245, 249, 1] },   // slate-100
            { position: 0.4, color: [147, 197, 253, 1] }, // blue-300
            { position: 1, color: [29, 78, 216, 1] }      // blue-700
        ]
    },
    orange: {
        label: "Energy (Orange)",
        stops: [
            { position: 0, color: [241, 245, 249, 1] },   // slate-100
            { position: 0.4, color: [253, 186, 116, 1] }, // orange-300
            { position: 1, color: [194, 65, 12, 1] }      // orange-700
        ]
    },
    violet: {
        label: "Deep Work (Purple)",
        stops: [
            { position: 0, color: [241, 245, 249, 1] },   // slate-100
            { position: 0.4, color: [216, 180, 254, 1] }, // purple-300
            { position: 1, color: [126, 34, 206, 1] }     // purple-700
        ]
    },
    rose: {
        label: "Passion (Rose)",
        stops: [
            { position: 0, color: [241, 245, 249, 1] },   // slate-100
            { position: 0.4, color: [253, 164, 175, 1] }, // rose-300
            { position: 1, color: [190, 18, 60, 1] }      // rose-700
        ]
    },
    fire: {
        label: "Intensity (Fire)",
        stops: [
            { position: 0, color: [255, 237, 213, 1] },   // orange-100
            { position: 0.5, color: [249, 115, 22, 1] },  // orange-500
            { position: 1, color: [185, 28, 28, 1] }      // red-700
        ]
    },
    custom: {
        label: "Custom Theme",
        stops: [
            { position: 0, color: [255, 0, 0, 1] },
            { position: 0.5, color: [255, 225, 0, 1] },
            { position: 1, color: [12, 148, 62, 1] }
        ]
    }

};



// --- 2. The Component ---
export const ColorScaleFieldInput = ({ field, className }: InputProps) => {

    const { onChange } = field;
    //TODO: We migth order the stops before saving or rendering, so we don't have to use the ordered version of color gradient utilities. 


    const [activeKey, setActiveKey] = useState<string | null>(null)

    const handleOnclick = (e: React.MouseEvent<HTMLButtonElement>, key: string, preset: Preset) => {
        e.preventDefault();
        onChange(preset.stops);
        setActiveKey(key);
    }


    return (
        <div className={`grid grid-cols-2 gap-3 ${className || ''}`}>
            {Object.entries(GRADIENT_PRESETS).map(([key, preset]) => {
                const isActive = activeKey === key;
                const background = gradientToCSS(preset.stops);

                return (
                    (key != "custom") ?
                        <BigButton
                            key={key}
                            type="button"
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleOnclick(e, key, preset)}
                            isSelected={isActive}
                            className='flex flex-col justify-center items-center'
                        >
                            {/* Gradient Preview Bar */}
                            <div
                                className="flex gap-2"
                            >
                                <div style={{
                                    backgroundColor: mapValueToCSSrgb(0, 0, 1, preset.stops),
                                    width: 20,
                                    height: 20,
                                    borderRadius: '25%',
                                }} />
                                <div style={{
                                    backgroundColor: mapValueToCSSrgb(0.25, 0, 1, preset.stops),
                                    width: 20,
                                    height: 20,
                                    borderRadius: '25%',
                                }} />
                                <div style={{
                                    backgroundColor: mapValueToCSSrgb(0.50, 0, 1, preset.stops),
                                    width: 20,
                                    height: 20,
                                    borderRadius: '25%',
                                }} />
                                <div style={{
                                    backgroundColor: mapValueToCSSrgb(0.75, 0, 1, preset.stops),
                                    width: 20,
                                    height: 20,
                                    borderRadius: '25%',
                                }} />
                                <div style={{
                                    backgroundColor: mapValueToCSSrgb(1, 0, 1, preset.stops),
                                    width: 20,
                                    height: 20,
                                    borderRadius: '25%',
                                }} />

                            </div>

                            <div className="text-left">
                                <span className="block text-sm font-bold text-foreground">
                                    {preset.label}
                                </span>
                            </div>


                        </BigButton>
                        :
                        <GradientPicker key={key} isActive={isActive} onChange={isActive ? onChange : undefined} onClick={() => setActiveKey(key)} />

                );
            })}


        </div>
    );
};
