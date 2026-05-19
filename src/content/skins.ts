export interface SkinDef {
  id: string;
  name: string;
  cost: number;
  primary: string;
  secondary: string;
  glow: string;
}

export const SKINS: SkinDef[] = [
  { id: 'neon-cyan', name: 'Neon Cyan', cost: 0, primary: '#00f3ff', secondary: '#00bfff', glow: '#00f3ff' },
  { id: 'sunburst', name: 'Sunburst', cost: 250, primary: '#ff9d2e', secondary: '#ffd14a', glow: '#ff9d2e' },
  { id: 'magenta', name: 'Magenta Pulse', cost: 250, primary: '#ff2bff', secondary: '#ffa9ff', glow: '#ff2bff' },
  { id: 'jungle', name: 'Jungle Bloom', cost: 400, primary: '#00ff8a', secondary: '#a4ff00', glow: '#00ff8a' },
  { id: 'cherry', name: 'Cherry Bomb', cost: 400, primary: '#ff255e', secondary: '#ff9bb1', glow: '#ff255e' },
  { id: 'frost', name: 'Frost Drift', cost: 500, primary: '#a4f0ff', secondary: '#ffffff', glow: '#a4f0ff' },
  { id: 'void', name: 'Void Knight', cost: 700, primary: '#7a3cff', secondary: '#d6b7ff', glow: '#7a3cff' },
  { id: 'gold', name: 'Gold Standard', cost: 900, primary: '#ffd400', secondary: '#ffe680', glow: '#ffd400' },
  { id: 'glitch', name: 'Glitch Phantom', cost: 1200, primary: '#88ffe0', secondary: '#ff2bff', glow: '#88ffe0' },
  { id: 'phoenix', name: 'Phoenix', cost: 1500, primary: '#ff6a00', secondary: '#ffea00', glow: '#ff6a00' },
  { id: 'oracle', name: 'Oracle', cost: 1800, primary: '#c0bfff', secondary: '#ff80ff', glow: '#c0bfff' },
  { id: 'apex', name: 'Apex Reward', cost: 2500, primary: '#ffffff', secondary: '#ff255e', glow: '#ff255e' },
];

export const getSkin = (id: string): SkinDef => SKINS.find((s) => s.id === id) ?? SKINS[0]!;
