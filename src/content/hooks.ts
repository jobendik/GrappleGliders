export interface HookDef {
  id: string;
  name: string;
  cost: number;
  rope: 'cable' | 'chain' | 'laser' | 'vine' | 'plasma' | 'thread' | 'lightning' | 'silk';
  color: string;
  width: number;
}

export const HOOKS: HookDef[] = [
  { id: 'cable', name: 'Standard Cable', cost: 0, rope: 'cable', color: '#00f3ff', width: 1.5 },
  { id: 'chain', name: 'Iron Chain', cost: 300, rope: 'chain', color: '#cfd8e3', width: 2.4 },
  { id: 'laser', name: 'Laser Beam', cost: 500, rope: 'laser', color: '#ff2bff', width: 1.2 },
  { id: 'vine', name: 'Living Vine', cost: 500, rope: 'vine', color: '#00ff8a', width: 2 },
  { id: 'plasma', name: 'Plasma Tether', cost: 800, rope: 'plasma', color: '#a45cff', width: 2.2 },
  { id: 'thread', name: 'Silk Thread', cost: 800, rope: 'thread', color: '#ffffff', width: 1 },
  { id: 'lightning', name: 'Lightning Coil', cost: 1200, rope: 'lightning', color: '#ffd400', width: 1.8 },
  { id: 'silk', name: 'Phantom Silk', cost: 1600, rope: 'silk', color: '#c0bfff', width: 1.3 },
];

export const getHook = (id: string): HookDef => HOOKS.find((h) => h.id === id) ?? HOOKS[0]!;
