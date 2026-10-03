import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { gradientToCSS, mapValueToColor, mapValueToCSSrgba } from '../../shared/utils/colorUtils';
import { GradientPicker } from '@/shared/components/GradientPicker';
import { BigButton } from '@/shared/components/BigButton';
import { COLOR_THEMES, GRADIENT_PRESET_STOPS, type ColorStop, type ColorTheme } from "@trackbit/types";
import { Field, FieldProps, InputProps } from '@/shared/components/Fields/FieldBase';
import { CollapsibleSection } from '@/shared/components/Collapsible';
import { BaseCell, GradientPreview } from '@/shared/components/Heatmap';
import { useTranslation } from 'react-i18next';


type Preset = {
    stops: ColorStop[];
};

export const GRADIENT_PRESETS = Object.fromEntries(
    COLOR_THEMES.map((theme) => [theme, { stops: GRADIENT_PRESET_STOPS[theme] }]),
) as Record<ColorTheme, Preset>;



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
    labelColorTheme,
    nameColorStops = "colorStops",
}: ColorScaleFieldProps) => {
    const { t } = useTranslation('habits');

    //TODO: We migth order the stops before saving or rendering, so we don't have to use the ordered version of color gradient utilities. 
    return (
        <Field
            label={labelColorTheme ?? t('form.color_theme')}
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
                                        <GradientPreview stops={preset.stops} cellSize='lg' />

                                        <div className="text-left">
                                            <span className="block text-sm font-bold text-foreground">
                                                {t(`theme.${key as ColorTheme}`)}
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
                                                                <GradientPreview stops={field.value} cellSize='lg' />

                                                                <div className="text-left">
                                                                    <span className="block text-sm font-bold text-foreground">
                                                                        {t(`theme.${key as ColorTheme}`)}
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




