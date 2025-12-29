import { ColorStop } from "@trackbit/types"


/**
 * Maps a numeric value within a range to a color in a gradient.
 * 
 * @param value - The value to map to a color
 * @param minValue - The minimum value of the range
 * @param maxValue - The maximum value of the range
 * @param stops - Array of color stops defining the gradient
 * @returns RGB color as [red, green, blue] tuple
 * 
 * @example
 * const gradient: ColorStop[] = [
 *   { position: 0.0, color: [0, 0, 255] },
 *   { position: 1.0, color: [255, 0, 0] }
 * ];
 * const color = mapValueToColor(50, 0, 100, gradient); // [128, 0, 128]
 */
export function mapValueToColor(
    value: number,
    minValue: number = 0,
    maxValue: number = 1,
    stops: ColorStop[]
): number[] {
    const normalizedPosition = (value - minValue) / (maxValue - minValue);
    const clampedPosition = Math.max(0, Math.min(1, normalizedPosition));

    if (clampedPosition <= stops[0].position) {
        return stops[0].color;
    }
    if (clampedPosition >= stops[stops.length - 1].position) {
        return stops[stops.length - 1].color;
    }

    let startStop: ColorStop | undefined;
    let endStop: ColorStop | undefined;

    for (let i = 0; i < stops.length - 1; i++) {
        if (clampedPosition >= stops[i].position &&
            clampedPosition <= stops[i + 1].position) {
            startStop = stops[i];
            endStop = stops[i + 1];
            break;
        }
    }

    if (!startStop || !endStop) {
        return stops[0].color;
    }

    const segmentRange = endStop.position - startStop.position;
    const localPosition = (clampedPosition - startStop.position) / segmentRange;

    return interpolateColors(startStop.color, endStop.color, localPosition);
}



export function mapValueToColorOrdered(
    value: number,
    minValue: number = 0,
    maxValue: number = 1,
    stops: ColorStop[]
): number[] {
    const normalizedPosition = (value - minValue) / (maxValue - minValue);
    const clampedPosition = Math.max(0, Math.min(1, normalizedPosition));
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);


    if (clampedPosition <= sortedStops[0].position) {
        return sortedStops[0].color;
    }
    if (clampedPosition >= sortedStops[sortedStops.length - 1].position) {
        return sortedStops[sortedStops.length - 1].color;
    }

    let startStop: ColorStop | undefined;
    let endStop: ColorStop | undefined;

    for (let i = 0; i < sortedStops.length - 1; i++) {
        if (clampedPosition >= sortedStops[i].position &&
            clampedPosition <= sortedStops[i + 1].position) {
            startStop = sortedStops[i];
            endStop = sortedStops[i + 1];
            break;
        }
    }

    if (!startStop || !endStop) {
        return sortedStops[0].color;
    }

    const segmentRange = endStop.position - startStop.position;
    const localPosition = (clampedPosition - startStop.position) / segmentRange;

    return interpolateColors(startStop.color, endStop.color, localPosition);
}


/**
 * Linearly interpolates between two RGB colors.
 * 
 * @param colorA - Starting RGB color
 * @param colorB - Ending RGB color
 * @param factor - Interpolation factor from 0.0 to 1.0
 * @returns Interpolated RGB color
 */
function interpolateColors(
    colorA: number[],
    colorB: number[],
    factor: number
): number[] {
    const result = [
        Math.round(colorA[0] + factor * (colorB[0] - colorA[0])),
        Math.round(colorA[1] + factor * (colorB[1] - colorA[1])),
        Math.round(colorA[2] + factor * (colorB[2] - colorA[2]))
    ];

    const alphaA = colorA[3] ?? 1;
    const alphaB = colorB[3] ?? 1;

    if (colorA.length > 3 || colorB.length > 3) {
        result.push(Number((alphaA + factor * (alphaB - alphaA)).toFixed(3)));
    }
    return result;
}



export function mapValueToCSSrgb(
    value: number,
    minValue: number = 0,
    maxValue: number = 1,
    stops: ColorStop[]) {
    const color = mapValueToColor(value, minValue, maxValue, stops);
    if (color.length > 3 && color[3] !== 1) {
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
    }
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

/**
 * Converts an RGB color to hexadecimal string format.
 * 
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Hex color string (e.g., "#ff0000")
 */
export function rgbToHex(r: number, g: number, b: number, a?: number): string {
    const hex = [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');

    if (a !== undefined && a !== 1) {
        const alpha = Math.round(a * 255);
        const alphaHex = alpha.toString(16);
        return '#' + hex + (alphaHex.length === 1 ? '0' + alphaHex : alphaHex);
    }
    return '#' + hex;
}

/**
 * Converts gradient color stops to a CSS linear-gradient string.
 * 
 * @param stops - Array of color stops defining the gradient
 * @param direction - CSS gradient direction (default: "to right")
 * @returns CSS linear-gradient string
 * 
 * @example
 * const css = gradientToCSS(stops, "to bottom");
 * element.style.background = css;
 */
export function gradientToCSS(
    stops: ColorStop[],
    direction: string = 'to right'
): string {
    const colorStops = stops.map(stop => {
        const [r, g, b, a] = stop.color;
        const percentage = (stop.position * 100).toFixed(1);
        if (a !== undefined && a !== 1) {
            return `rgba(${r}, ${g}, ${b}, ${a}) ${percentage}%`;
        }
        return `rgb(${r}, ${g}, ${b}) ${percentage}%`;
    }).join(', ');

    return `linear-gradient(${direction}, ${colorStops})`;
}



/**
 * Converts gradient color stops to a CSS linear-gradient string.
 * 
 * @param stops - Array of color stops defining the gradient
 * @param direction - CSS gradient direction (default: "to right")
 * @returns CSS linear-gradient string
 * 
 * @example
 * const css = gradientToCSS(stops, "to bottom");
 * element.style.background = css;
 */
export function gradientToCSSOrdered(
    stops: ColorStop[],
    direction: string = 'to right'
): string {

    const colorStops = [...stops]
        .sort((a, b) => a.position - b.position)
        .map(stop => {
            const [r, g, b, a] = stop.color;
            const percentage = (stop.position * 100).toFixed(1);
            if (a !== undefined && a !== 1) {
                return `rgba(${r}, ${g}, ${b}, ${a}) ${percentage}%`;
            }
            return `rgb(${r}, ${g}, ${b}) ${percentage}%`;
        })
        .join(', ');

    return `linear-gradient(${direction}, ${colorStops})`;
}



/**
 * Converts gradient color stops to a CSS linear-gradient string using hex colors.
 * 
 * @param stops - Array of color stops defining the gradient
 * @param direction - CSS gradient direction (default: "to right")
 * @returns CSS linear-gradient string with hex colors
 */
export function gradientToCSSHex(
    stops: ColorStop[],
    direction: string = 'to right'
): string {
    const colorStops = stops.map(stop => {
        const hex = rgbToHex(...stop.color);
        const percentage = (stop.position * 100).toFixed(1);
        return `${hex} ${percentage}%`;
    }).join(', ');

    return `linear-gradient(${direction}, ${colorStops})`;
}
