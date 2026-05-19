export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const rand = (min: number, max: number): number => min + Math.random() * (max - min);

export const randInt = (min: number, max: number): number =>
  Math.floor(min + Math.random() * (max - min + 1));

export const sign = (x: number): number => (x < 0 ? -1 : x > 0 ? 1 : 0);

export const wrap = (v: number, max: number): number => ((v % max) + max) % max;

export const TWO_PI = Math.PI * 2;
