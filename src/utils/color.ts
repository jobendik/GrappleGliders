/** Convert a CSS color (hex, rgb(), rgba()) to an rgba() string with the given alpha. */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba')) {
    return color.replace(/,[^,]+\)$/, `,${alpha})`);
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  }
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Mix two hex colors. t=0 returns a, t=1 returns b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

export function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, Math.round(r + (255 - r) * amount))},${Math.min(255, Math.round(g + (255 - g) * amount))},${Math.min(255, Math.round(b + (255 - b) * amount))})`;
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * (1 - amount))},${Math.round(g * (1 - amount))},${Math.round(b * (1 - amount))})`;
}
