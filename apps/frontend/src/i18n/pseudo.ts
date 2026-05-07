const ACCENTS: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'đ', e: 'é', f: 'ƒ', g: 'ǧ', h: 'ĥ',
  i: 'í', j: 'ǰ', k: 'ǩ', l: 'ł', m: 'ɱ', n: 'ñ', o: 'ó', p: 'ƥ',
  q: 'ʠ', r: 'ř', s: 'š', t: 'ţ', u: 'ú', v: 'ʋ', w: 'ŵ', x: 'ẋ',
  y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Đ', E: 'É', F: 'Ƒ', G: 'Ǧ', H: 'Ĥ',
  I: 'Í', J: 'Ĵ', K: 'Ǩ', L: 'Ł', M: 'Ɱ', N: 'Ñ', O: 'Ó', P: 'Ƥ',
  Q: 'Ǫ', R: 'Ř', S: 'Š', T: 'Ţ', U: 'Ú', V: 'Ʋ', W: 'Ŵ', X: 'Ẋ',
  Y: 'Ý', Z: 'Ž',
};

// Tokens we must not transform: ICU placeholders {…} (incl. nested plural/select)
// and react-i18next component interpolation <0>…</0>, <1/>, etc.
const PRESERVE_RE = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|<\/?\d+\/?>/g;

function accentize(s: string): string {
  let out = '';
  for (const ch of s) out += ACCENTS[ch] ?? ch;
  return out;
}

function pseudoize(input: string): string {
  // Split around preserved tokens, transform only the literal text segments.
  const parts: string[] = [];
  let last = 0;
  for (const match of input.matchAll(PRESERVE_RE)) {
    const start = match.index!;
    if (start > last) parts.push(accentize(input.slice(last, start)));
    parts.push(match[0]);
    last = start + match[0].length;
  }
  if (last < input.length) parts.push(accentize(input.slice(last)));

  const transformed = parts.join('');
  // ~30% padding to surface layout overflow. Vowel pad reads as foreign-language tail.
  const padLen = Math.max(2, Math.ceil(transformed.length * 0.3));
  const pad = 'éíóú'.repeat(Math.ceil(padLen / 4)).slice(0, padLen);
  return `⟦${transformed} ${pad}⟧`;
}

export function pseudoizeBundle(
  bundle: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(bundle)) {
    out[k] = typeof v === 'string' ? pseudoize(v) : v;
  }
  return out;
}

export const PSEUDO_LOCALE = 'en-XA';

export function isPseudoEnabled(): boolean {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_ENABLE_PSEUDO === 'true'
  );
}
