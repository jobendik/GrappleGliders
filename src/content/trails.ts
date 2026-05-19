export interface TrailDef {
  id: string;
  name: string;
  cost: number;
  colors: string[];
  fade: number;
}

export const TRAILS: TrailDef[] = [
  { id: 'cyan-streak', name: 'Cyan Streak', cost: 0, colors: ['#00f3ff'], fade: 0.06 },
  { id: 'rainbow', name: 'Rainbow Streak', cost: 350, colors: ['#ff255e', '#ff9d2e', '#ffd400', '#00ff8a', '#00f3ff', '#a45cff', '#ff2bff'], fade: 0.05 },
  { id: 'fire', name: 'Inferno', cost: 400, colors: ['#ff6a00', '#ffea00', '#ff255e'], fade: 0.08 },
  { id: 'ghost', name: 'Ghost Trace', cost: 400, colors: ['#ffffff', '#a4f0ff'], fade: 0.04 },
  { id: 'glitch', name: 'Glitch', cost: 600, colors: ['#88ffe0', '#ff2bff', '#000000'], fade: 0.07 },
  { id: 'void', name: 'Void Streak', cost: 600, colors: ['#7a3cff', '#1a002b'], fade: 0.05 },
  { id: 'circuit', name: 'Circuit', cost: 800, colors: ['#00ff8a', '#00f3ff'], fade: 0.06 },
  { id: 'aurora', name: 'Aurora', cost: 800, colors: ['#a4ff00', '#00f3ff', '#ff2bff'], fade: 0.05 },
  { id: 'cherry', name: 'Cherry Trail', cost: 900, colors: ['#ff255e', '#ffa9ff'], fade: 0.06 },
  { id: 'gold', name: 'Gold Sparkle', cost: 1100, colors: ['#ffd400', '#ffffff'], fade: 0.06 },
  { id: 'phoenix', name: 'Phoenix Flame', cost: 1400, colors: ['#ff6a00', '#ffd400', '#ff2bff'], fade: 0.08 },
  { id: 'apex', name: 'Apex Wake', cost: 2000, colors: ['#ff255e', '#a45cff', '#00f3ff'], fade: 0.05 },
];

export const getTrail = (id: string): TrailDef => TRAILS.find((t) => t.id === id) ?? TRAILS[0]!;
