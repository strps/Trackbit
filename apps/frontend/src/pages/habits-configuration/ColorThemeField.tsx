import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { gradientToCSS, mapValueToColor, mapValueToCSSrgb } from '../../lib/colorUtils';
import { GradientPicker } from '../../components/GradientPicker';
import { BigButton } from '@/components/BigButton';
import { ColorStop } from "@trackbit/types";
import { Field, FieldProps, InputProps } from '@/components/Fields/FieldBase';
import { CollapsibleSection } from '@/components/Collapsible';


type Preset = {
    label: string;
    stops: ColorStop[];
};

export const GRADIENT_PRESETS: Record<string, Preset> = {
    green: {
        label: "Growth (Green)",
        stops: [
            { position: 0, color: [241, 245, 249, 0.1] },   // slate-100
            { position: 0.4, color: [134, 239, 172, 0.4] }, // green-300
            { position: 1, color: [21, 128, 61, 1] }      // green-700
        ]
    },
    blue: {
        label: "Focus (Blue)",
        stops: [
            { position: 0, color: [241, 245, 249, 0.1] },   // slate-100
            { position: 0.4, color: [147, 197, 253, 0.4] }, // blue-300
            { position: 1, color: [29, 78, 216, 1] }      // blue-700
        ]
    },
    orange: {
        label: "Energy (Orange)",
        stops: [
            { position: 0, color: [241, 245, 249, 0.1] },   // slate-100
            { position: 0.4, color: [253, 186, 116, 0.4] }, // orange-300
            { position: 1, color: [194, 65, 12, 1] }      // orange-700
        ]
    },
    violet: {
        label: "Deep Work (Purple)",
        stops: [
            { position: 0, color: [241, 245, 249, 0.1] },   // slate-100
            { position: 0.4, color: [216, 180, 254, 0.4] }, // purple-300
            { position: 1, color: [126, 34, 206, 1] }     // purple-700
        ]
    },
    rose: {
        label: "Passion (Rose)",
        stops: [
            { position: 0, color: [241, 245, 249, 0.1] },   // slate-100
            { position: 0.4, color: [253, 164, 175, 0.4] }, // rose-300
            { position: 1, color: [190, 18, 60, 1] }      // rose-700
        ]
    },
    fire: {
        label: "Intensity (Fire)",
        stops: [
            { position: 0, color: [255, 237, 213, 0.1] },   // orange-100
            { position: 0.5, color: [249, 115, 22, 0.5] },  // orange-500
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

//type for props
interface ColorScaleFieldProps extends Omit<FieldProps, 'name' | 'fieldInput'> {
    labelColorTheme?: string;
    nameColorTheme?: string;
    labelColorStops?: string;
    nameColorStops?: string;
}


export const ColorThemeField = ({
    form,
    nameColorTheme = "colorTheme",
    labelColorTheme = "Color Theme",
    nameColorStops = "colorStops",
}: ColorScaleFieldProps) => {

    //TODO: We migth order the stops before saving or rendering, so we don't have to use the ordered version of color gradient utilities. 




    const GradientPreview = ({ stops }: { stops: ColorStop[] }) => {
        return (
            <div
                className="flex gap-2"
            >
                <div style={{
                    backgroundColor: mapValueToCSSrgb(0, 0, 1, stops),
                    width: 20,
                    height: 20,
                    borderRadius: '25%'

                }}
                    className="border border-border"
                />
                <div style={{
                    backgroundColor: mapValueToCSSrgb(0.25, 0, 1, stops),
                    width: 20,
                    height: 20,
                    borderRadius: '25%',
                }}
                    className="border border-border"
                />
                <div style={{
                    backgroundColor: mapValueToCSSrgb(0.50, 0, 1, stops),
                    width: 20,
                    height: 20,
                    borderRadius: '25%',
                }}
                    className="border border-border"
                />
                <div style={{
                    backgroundColor: mapValueToCSSrgb(0.75, 0, 1, stops),
                    width: 20,
                    height: 20,
                    borderRadius: '25%',
                }}
                    className="border border-border"
                />
                <div style={{
                    backgroundColor: mapValueToCSSrgb(1, 0, 1, stops),
                    width: 20,
                    height: 20,
                    borderRadius: '25%',
                }}
                    className="border border-border"
                />

            </div>
        )
    }



    return (
        <Field
            label={labelColorTheme}
            form={form}
            name={nameColorTheme}
            fieldInput={({ field, className }: InputProps) => {
                const handleOnclick = (e: React.MouseEvent<HTMLDivElement>, key: string,) => {
                    e.preventDefault();
                    field.onChange(key);
                }
                return (
                    <div className={`grid grid-cols-2 gap-3 ${className || ''}`}>
                        {Object.entries(GRADIENT_PRESETS).map(([key, preset]) => {
                            const isActive = field.value === key;
                            const background = gradientToCSS(preset.stops);

                            return (
                                (key != "custom") ?
                                    <BigButton
                                        key={key}
                                        onClick={(e: React.MouseEvent<HTMLDivElement>) => handleOnclick(e, key)}
                                        isSelected={isActive}
                                        className='flex flex-col justify-center items-center'
                                    >
                                        <GradientPreview stops={preset.stops} />

                                        <div className="text-left">
                                            <span className="block text-sm font-bold text-foreground">
                                                {preset.label}
                                            </span>
                                        </div>


                                    </BigButton>
                                    :
                                    <BigButton
                                        key={key}
                                        onClick={(e: React.MouseEvent<HTMLDivElement>) => handleOnclick(e, key)}
                                        isSelected={isActive}
                                        className='flex flex-col justify-center items-center col-span-2 p-0'

                                    >


                                        <Field
                                            form={form}
                                            name={nameColorStops}
                                            fieldInput={({ field, className }: InputProps) => {
                                                return (
                                                    <CollapsibleSection
                                                        className={`w-full h-full flex flex-col border-0 justify-center py-4`}
                                                        isOpen={isActive}
                                                        headerContent={
                                                            <div className='flex flex-col gap-4 items-center w-full'>
                                                                <GradientPreview stops={field.value} />

                                                                <div className="text-left">
                                                                    <span className="block text-sm font-bold text-foreground">
                                                                        {preset.label}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                        }
                                                    >
                                                        <GradientPicker
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                        />
                                                    </CollapsibleSection>
                                                )
                                            }}
                                        />

                                    </BigButton>

                            );
                        })}


                    </div>
                )
            }}
        >

        </Field>
    );
};
