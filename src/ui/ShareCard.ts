import { GameMode } from '../game/GameState';
import { formatAltitude, formatScore, formatTimeMs } from '../utils/format';

export interface ShareCardTrick {
  name: string;
  count: number;
  color: string;
}

export interface ShareCardData {
  mode: GameMode;
  score: number;
  altitude: number;
  peakCombo: number;
  elapsedSeconds: number;
  playerName: string;
  /** Optional daily rank, only shown when mode is DailyChallenge. */
  dailyRank?: number;
  /** Page URL the player should share — usually the CrazyGames listing. */
  gameUrl: string;
  /** Top tricks landed this run, in descending score order. Up to 4 are rendered. */
  topTricks?: ShareCardTrick[];
  /** Whether this run set a personal best — gets a star badge. */
  isPersonalBest?: boolean;
}

const MODE_LABEL: Record<GameMode, string> = {
  [GameMode.EndlessClimb]: 'ENDLESS CLIMB',
  [GameMode.DailyChallenge]: 'DAILY CHALLENGE',
  [GameMode.TimeAttack]: 'TIME ATTACK',
  [GameMode.BotRace]: 'BOT RACE',
  [GameMode.ComboRun]: 'COMBO RUN',
};

const HEADLINE = (data: ShareCardData): string => {
  switch (data.mode) {
    case GameMode.EndlessClimb:
      return `${formatAltitude(data.altitude)}`;
    case GameMode.DailyChallenge:
      return data.dailyRank ? `RANK #${data.dailyRank}` : `${formatScore(data.score)}`;
    case GameMode.TimeAttack:
      return formatTimeMs(data.elapsedSeconds);
    case GameMode.BotRace:
      return `${formatAltitude(data.altitude)}`;
    case GameMode.ComboRun:
      return `×${data.peakCombo}`;
  }
};

const SUB_STATS = (data: ShareCardData): Array<[string, string]> => [
  ['SCORE', formatScore(data.score)],
  ['ALTITUDE', formatAltitude(data.altitude)],
  ['PEAK COMBO', `×${data.peakCombo}`],
  ['TIME', formatTimeMs(data.elapsedSeconds)],
];

/**
 * Render a 1200×630 share card to an offscreen canvas. The dimensions match
 * Open Graph / Twitter card spec so the image works as both a copy-paste
 * screenshot and a future social-meta preview.
 */
export const renderShareCard = (data: ShareCardData): HTMLCanvasElement => {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background — synthwave sky → magenta horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0524');
  sky.addColorStop(0.6, '#1a0c46');
  sky.addColorStop(1, '#ff2bff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun.
  const sun = ctx.createRadialGradient(W * 0.78, H * 0.62, 30, W * 0.78, H * 0.62, 260);
  sun.addColorStop(0, '#ffd400');
  sun.addColorStop(0.5, '#ff7a1a');
  sun.addColorStop(1, 'rgba(255,42,255,0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.62, 260, 0, Math.PI * 2);
  ctx.fill();

  // Sun horizontal slices.
  ctx.fillStyle = 'rgba(10,5,36,0.8)';
  for (let i = 0; i < 6; i++) {
    const y = H * 0.62 - 40 + i * 14;
    ctx.fillRect(W * 0.78 - 220, y, 440, 4);
  }

  // Grid floor.
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.18)';
  ctx.lineWidth = 1.2;
  const horizonY = H * 0.7;
  for (let x = 0; x <= W; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, horizonY);
    const off = (x - W / 2) * 4;
    ctx.lineTo(W / 2 + off, H);
    ctx.stroke();
  }
  for (let i = 1; i <= 8; i++) {
    const y = horizonY + (i * i * 2.5);
    if (y > H) break;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Lava strip at the bottom.
  const lava = ctx.createLinearGradient(0, H - 60, 0, H);
  lava.addColorStop(0, 'rgba(255, 122, 26, 0)');
  lava.addColorStop(0.4, '#ff7a1a');
  lava.addColorStop(1, '#ff255e');
  ctx.fillStyle = lava;
  ctx.fillRect(0, H - 60, W, 60);

  // Top-left mode chip.
  drawChip(ctx, 56, 56, MODE_LABEL[data.mode], '#00f3ff');
  // Personal-best badge — sits to the right of the mode chip when applicable.
  if (data.isPersonalBest) {
    drawChip(ctx, 240, 56, '★ NEW PB', '#ffd400');
  }

  // Top-right brand wordmark.
  ctx.font = '700 26px "Orbitron", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#a4f0ff';
  ctx.shadowColor = 'rgba(0,243,255,0.6)';
  ctx.shadowBlur = 16;
  ctx.fillText('GRAPPLE GLIDERS', W - 56, 72);
  ctx.shadowBlur = 0;

  // Player name.
  ctx.font = '600 30px "Rajdhani", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.playerName.toUpperCase(), 56, 150);

  // Headline number (the big sharable stat).
  const headline = HEADLINE(data);
  ctx.font = '900 168px "Orbitron", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Cyan→magenta gradient on the headline.
  const headGrad = ctx.createLinearGradient(56, 280, 56, 360);
  headGrad.addColorStop(0, '#00f3ff');
  headGrad.addColorStop(1, '#ff2bff');
  ctx.fillStyle = headGrad;
  ctx.shadowColor = 'rgba(0,243,255,0.5)';
  ctx.shadowBlur = 24;
  ctx.fillText(headline, 56, 350);
  ctx.shadowBlur = 0;

  // Headline caption.
  const caption =
    data.mode === GameMode.TimeAttack
      ? 'CLEAR TIME'
      : data.mode === GameMode.ComboRun
        ? 'PEAK COMBO'
        : data.mode === GameMode.DailyChallenge && data.dailyRank
          ? "TODAY'S DAILY"
          : 'ALTITUDE REACHED';
  ctx.font = '700 22px "Rajdhani", system-ui, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillStyle = '#a4f0ff';
  ctx.fillText(caption, 60, 392);

  // Stat strip.
  const stats = SUB_STATS(data);
  const stripY = 460;
  const stripH = 96;
  const cellW = (W - 112) / stats.length;
  ctx.fillStyle = 'rgba(7, 12, 28, 0.65)';
  roundedRect(ctx, 56, stripY, W - 112, stripH, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.35)';
  ctx.lineWidth = 1.5;
  roundedRect(ctx, 56, stripY, W - 112, stripH, 18);
  ctx.stroke();
  for (let i = 0; i < stats.length; i++) {
    const cx = 56 + cellW * i + cellW / 2;
    ctx.font = '700 14px "Rajdhani", system-ui, sans-serif';
    ctx.fillStyle = '#a4f0ff';
    ctx.textAlign = 'center';
    ctx.fillText(stats[i]![0], cx, stripY + 30);
    ctx.font = '700 32px "Orbitron", system-ui, sans-serif';
    ctx.fillStyle = '#eaffff';
    ctx.fillText(stats[i]![1], cx, stripY + 72);
    if (i < stats.length - 1) {
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.18)';
      ctx.beginPath();
      ctx.moveTo(56 + cellW * (i + 1), stripY + 18);
      ctx.lineTo(56 + cellW * (i + 1), stripY + stripH - 18);
      ctx.stroke();
    }
  }

  // Trick chip row — below the stat strip when tricks were landed this run.
  if (data.topTricks && data.topTricks.length > 0) {
    const tricks = data.topTricks.slice(0, 4);
    let x = 56;
    const y = stripY + stripH + 32;
    ctx.textBaseline = 'middle';
    for (const t of tricks) {
      const label = t.count > 1 ? `${t.name} ×${t.count}` : t.name;
      x += drawChip(ctx, x, y, label, t.color) + 10;
    }
  }

  // Footer CTA — bigger and more enticing than before. Different verb per mode
  // gives the share card a sharper, more competitive read.
  const ctaPrimary = data.isPersonalBest ? 'CHASE THE TOP' : ctaText(data);
  ctx.font = '900 26px "Orbitron", system-ui, sans-serif';
  const cta = ctx.createLinearGradient(56, H - 30, 56, H - 4);
  cta.addColorStop(0, '#ffd400');
  cta.addColorStop(1, '#ff9d2e');
  ctx.fillStyle = cta;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(255,212,0,0.4)';
  ctx.shadowBlur = 14;
  ctx.fillText(ctaPrimary, 56, H - 14);
  ctx.shadowBlur = 0;
  ctx.font = '600 16px "Rajdhani", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(234,255,255,0.85)';
  ctx.textAlign = 'right';
  ctx.fillText(shortUrl(data.gameUrl), W - 56, H - 14);

  return canvas;
};

/** Mode-aware call to action printed in the footer of the share card. */
const ctaText = (data: ShareCardData): string => {
  switch (data.mode) {
    case GameMode.TimeAttack:
      return 'CAN YOU GO FASTER?';
    case GameMode.DailyChallenge:
      return data.dailyRank ? 'CLIMB THE BOARD' : 'TAKE THE DAILY';
    case GameMode.ComboRun:
      return 'CHAIN A BIGGER COMBO';
    case GameMode.BotRace:
      return 'OUTPACE THE BOTS';
    case GameMode.EndlessClimb:
    default:
      return 'CAN YOU CLIMB HIGHER?';
  }
};

/** Render a pill-shaped chip at (x,y). Returns the chip width for layout chaining. */
const drawChip = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
): number => {
  ctx.font = '700 16px "Rajdhani", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const padX = 18;
  const w = ctx.measureText(label).width + padX * 2;
  const h = 36;
  ctx.fillStyle = 'rgba(7, 12, 28, 0.7)';
  roundedRect(ctx, x, y - h / 2, w, h, 999);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  roundedRect(ctx, x, y - h / 2, w, h, 999);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(label, x + padX, y + 1);
  return w;
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  const radius = Math.min(r, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const shortUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname.replace(/\/$/, '')}`;
  } catch {
    return url;
  }
};

export const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
