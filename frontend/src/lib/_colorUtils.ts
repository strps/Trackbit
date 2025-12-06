// Color utilities implemented with Culori
// Install: npm install culori

import {
    parse,
    formatRgb,
    rgb,
    oklch,
    converter,
    interpolate,
    wcagContrast,
    clampChroma,
} from "culori";

// ---------- Types ----------
export type RGB = [number, number, number];
export interface ColorStop {
    position: number; // 0..1
    color: RGB;
}

// ---------- Conversion Helpers ----------
export function hexToRgb(hex: string): RGB {
    const c = parse(hex);
    const { r, g, b } = rgb(c);
    return [r * 255, g * 255, b * 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
    return formatRgb({ r: r / 255, g: g / 255, b: b / 255 });
}

export function rgbArrayToHex(color: RGB): string {
    return rgbToHex(color[0], color[1], color[2]);
}

// ---------- Contrast Helpers ----------
export function bestTextColor(bg: RGB): RGB {
    const white: RGB = [255, 255, 255];
    const black: RGB = [0, 0, 0];

    const bgC = { r: bg[0] / 255, g: bg[1] / 255, b: bg[2] / 255 };
    const contrastWhite = wcagContrast(bgC, { r: 1, g: 1, b: 1 });
    const contrastBlack = wcagContrast(bgC, { r: 0, g: 0, b: 0 });

    return contrastWhite >= contrastBlack ? white : black;
}

export function bestContrastFrom(bg: RGB, options: RGB[]): RGB {
    const bgNorm = { r: bg[0] / 255, g: bg[1] / 255, b: bg[2] / 255 };
    let best = options[0];
    let bestScore = -Infinity;

    for (const opt of options) {
        const oNorm = { r: opt[0] / 255, g: opt[1] / 255, b: opt[2] / 255 };
        const score = wcagContrast(bgNorm, oNorm);
        if (score > bestScore) {
            best = opt;
            bestScore = score;
        }
    }
    return best;
}

// ---------- Gradient + Mapping ----------
export function mapValueToColor(
    value: number,
    min: number,
    max: number,
    stops: ColorStop[]
): RGB {
    const t = Math.min(1, Math.max(0, (value - min) / (max - min)));

    const sorted = [...stops].sort((a, b) => a.position - b.position);

    let left = sorted[0];
    let right = sorted[sorted.length - 1];

    for (let i = 0; i < sorted.length - 1; i++) {
        if (t >= sorted[i].position && t <= sorted[i + 1].position) {
            left = sorted[i];
            right = sorted[i + 1];
            break;
        }
    }

    const localT =
        (t - left.position) / (right.position - left.position || 1);

    const interp = interpolate([toCulori(left.color), toCulori(right.color)], {
        space: oklch,
    });
    const col = interp(localT);
    return fromCulori(col);
}

export function gradientToCSS(
    stops: ColorStop[],
    direction: string = "to right"
): string {
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    const parts = sorted.map((s) => {
        return `${rgbArrayToHex(s.color)} ${s.position * 100}%`;
    });
    return `linear-gradient(${direction}, ${parts.join(", ")})`;
}

export function gradientToCSSOrdered(
    stops: ColorStop[],
    direction: string = "to right"
): string {
    return gradientToCSS(stops, direction);
}

// ---------- Helpers ----------
function toCulori(color: RGB) {
    return { r: color[0] / 255, g: color[1] / 255, b: color[2] / 255 };
}

function fromCulori({ r, g, b }: any): RGB {
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// ---------- Backward Compatibility Layer ----------
/** @deprecated */
export function mapValueToColorOrdered(
    value: number,
    min: number,
    max: number,
    stops: ColorStop[]
): RGB {
    console.warn("mapValueToColorOrdered is deprecated — use mapValueToColor()");
    return mapValueToColor(value, min, max, stops);
}

/** @deprecated */
export function mapValueToCSSrgb(
    value: number,
    min: number,
    max: number,
    stops: ColorStop[]
): string {
    console.warn("mapValueToCSSrgb is deprecated — use mapValueToColor + formatting");
    const c = mapValueToColor(value, min, max, stops);
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** @deprecated */
export function gradientToCSSHex(
    stops: ColorStop[],
    direction: string = "to right"
): string {
    console.warn("gradientToCSSHex is deprecated — use gradientToCSS()");
    return gradientToCSS(stops, direction);
}
