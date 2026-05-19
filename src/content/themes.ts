export interface ThemeDef {
  id: string;
  name: string;
  cost: number;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  horizon: string;
  grid: string;
  lava: [string, string];
  cityFar: string;
  cityNear: string;
  accent: string;
  star: string;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'synthwave',
    name: 'Synthwave',
    cost: 0,
    skyTop: '#11142a',
    skyMid: '#03040a',
    skyBottom: '#000000',
    horizon: '#ff2bff',
    grid: 'rgba(0, 243, 255, 0.16)',
    lava: ['#ff255e', '#ff9d2e'],
    cityFar: 'rgba(122, 60, 255, 0.32)',
    cityNear: 'rgba(255, 43, 255, 0.42)',
    accent: '#00f3ff',
    star: '#eaffff',
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    cost: 600,
    skyTop: '#1a002b',
    skyMid: '#33055e',
    skyBottom: '#000010',
    horizon: '#00f3ff',
    grid: 'rgba(255, 43, 255, 0.22)',
    lava: ['#ff2bff', '#a45cff'],
    cityFar: 'rgba(255, 43, 255, 0.3)',
    cityNear: 'rgba(0, 243, 255, 0.4)',
    accent: '#ff2bff',
    star: '#ffbfff',
  },
  {
    id: 'cyber-noir',
    name: 'Cyber Noir',
    cost: 800,
    skyTop: '#0a0a14',
    skyMid: '#000408',
    skyBottom: '#000',
    horizon: '#00ff8a',
    grid: 'rgba(0, 255, 138, 0.18)',
    lava: ['#00ff8a', '#00f3ff'],
    cityFar: 'rgba(0, 255, 138, 0.28)',
    cityNear: 'rgba(0, 243, 255, 0.36)',
    accent: '#00ff8a',
    star: '#e0ffe6',
  },
  {
    id: 'neon-jungle',
    name: 'Neon Jungle',
    cost: 1000,
    skyTop: '#021a14',
    skyMid: '#011a08',
    skyBottom: '#000',
    horizon: '#a4ff00',
    grid: 'rgba(164, 255, 0, 0.18)',
    lava: ['#a4ff00', '#00ff8a'],
    cityFar: 'rgba(164, 255, 0, 0.26)',
    cityNear: 'rgba(0, 255, 138, 0.36)',
    accent: '#a4ff00',
    star: '#eaffe0',
  },
  {
    id: 'blood-moon',
    name: 'Blood Moon',
    cost: 1400,
    skyTop: '#1f0408',
    skyMid: '#0a0204',
    skyBottom: '#000',
    horizon: '#ff255e',
    grid: 'rgba(255, 37, 94, 0.18)',
    lava: ['#ff255e', '#ff6a00'],
    cityFar: 'rgba(255, 37, 94, 0.28)',
    cityNear: 'rgba(255, 106, 0, 0.4)',
    accent: '#ff255e',
    star: '#ffbfc8',
  },
  {
    id: 'ice-station',
    name: 'Ice Station',
    cost: 1800,
    skyTop: '#04102a',
    skyMid: '#020816',
    skyBottom: '#000',
    horizon: '#a4f0ff',
    grid: 'rgba(164, 240, 255, 0.18)',
    lava: ['#a4f0ff', '#00f3ff'],
    cityFar: 'rgba(164, 240, 255, 0.2)',
    cityNear: 'rgba(0, 243, 255, 0.36)',
    accent: '#a4f0ff',
    star: '#ffffff',
  },
];

export const getTheme = (id: string): ThemeDef => THEMES.find((t) => t.id === id) ?? THEMES[0]!;
