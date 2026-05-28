import type { ColorStop } from "@/lib/habits-api";

export function mapValueToColor(
  value: number,
  min: number,
  max: number,
  stops: ColorStop[],
): number[] {
  if (!stops || stops.length === 0) return [128, 128, 128, 0];
  const normalizedPosition = (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, normalizedPosition));

  if (clamped <= stops[0].position) return [...stops[0].color];
  if (clamped >= stops[stops.length - 1].position) return [...stops[stops.length - 1].color];

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (clamped >= a.position && clamped <= b.position) {
      const local = (clamped - a.position) / (b.position - a.position);
      const ca = a.color;
      const cb = b.color;
      const result = [
        Math.round(ca[0] + local * (cb[0] - ca[0])),
        Math.round(ca[1] + local * (cb[1] - ca[1])),
        Math.round(ca[2] + local * (cb[2] - ca[2])),
      ];
      const alphaA = ca[3] ?? 1;
      const alphaB = cb[3] ?? 1;
      result.push(Number((alphaA + local * (alphaB - alphaA)).toFixed(3)));
      return result;
    }
  }
  return [...stops[0].color];
}

export function mapValueToRgbaString(
  value: number,
  min: number,
  max: number,
  stops: ColorStop[],
): string {
  const [r, g, b, a = 1] = mapValueToColor(value, min, max, stops);
  return `rgba(${r},${g},${b},${a})`;
}
