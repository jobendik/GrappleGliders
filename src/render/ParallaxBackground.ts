import { SeededRandom } from '../utils/seededRandom';
import { withAlpha as hexToRgba, lighten, darken } from '../utils/color';
import type { ThemeDef } from '../content/themes';
import type { Renderer } from './Renderer';
import type { Camera } from '../game/Camera';

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  twinkle: number;
  hue: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface CityBuilding {
  w: number;
  h: number;
  windowSeed: number;
}

export class ParallaxBackground {
  private stars: Star[] = [];
  private cityFar: CityBuilding[] = [];
  private cityNear: CityBuilding[] = [];
  private shootingStars: ShootingStar[] = [];
  private shootingStarCooldown = 0;
  private rng = new SeededRandom(1337);

  init(width: number, height: number): void {
    this.stars.length = 0;
    const count = 180;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: this.rng.next() * width,
        y: this.rng.next() * height,
        z: 0.3 + this.rng.next() * 0.7,
        size: this.rng.next() < 0.82 ? 1.2 : this.rng.next() < 0.95 ? 2.2 : 3.0,
        twinkle: this.rng.next() * Math.PI * 2,
        hue: this.rng.next(),
      });
    }
    this.cityFar = Array.from({ length: 36 }, () => ({
      w: this.rng.range(24, 56),
      h: this.rng.range(40, 130),
      windowSeed: this.rng.next(),
    }));
    this.cityNear = Array.from({ length: 28 }, () => ({
      w: this.rng.range(34, 86),
      h: this.rng.range(80, 220),
      windowSeed: this.rng.next(),
    }));
    this.shootingStars = [];
    this.shootingStarCooldown = 240;
  }

  draw(renderer: Renderer, camera: Camera, theme: ThemeDef, time: number, lowQuality: boolean): void {
    const ctx = renderer.ctx;
    const w = renderer.cssWidth;
    const h = renderer.cssHeight;

    this.drawSky(ctx, w, h, theme);
    if (lowQuality) {
      this.drawCityFar(ctx, w, h, camera, theme, true);
      this.drawCityNear(ctx, w, h, camera, theme, true);
      this.drawGrid(ctx, w, h, camera, theme, time, true);
      return;
    }

    this.drawNebula(ctx, w, h, theme, time);
    this.drawMoon(ctx, w, h, theme, time);
    this.drawStars(ctx, w, h, camera, theme, time);
    this.updateAndDrawShootingStars(ctx, w, h);
    this.drawCityFar(ctx, w, h, camera, theme, false);
    this.drawHorizonGlow(ctx, w, h, theme, time);
    this.drawCityNear(ctx, w, h, camera, theme, false);
    this.drawGrid(ctx, w, h, camera, theme, time, false);
  }

  private drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, theme: ThemeDef): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(0.55, theme.skyMid);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private drawNebula(ctx: CanvasRenderingContext2D, w: number, h: number, theme: ThemeDef, time: number): void {
    // Two soft drifting nebula bands using "screen" blending so they pop without
    // washing out the dark sky underneath.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const drift1 = Math.sin(time * 0.003) * 40;
    const drift2 = Math.cos(time * 0.002) * 60;

    const band1 = ctx.createRadialGradient(
      w * 0.28 + drift1,
      h * 0.32,
      0,
      w * 0.28 + drift1,
      h * 0.32,
      Math.max(w, h) * 0.55,
    );
    band1.addColorStop(0, hexToRgba(theme.accent, 0.22));
    band1.addColorStop(0.4, hexToRgba(theme.accent, 0.07));
    band1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = band1;
    ctx.fillRect(0, 0, w, h);

    const band2 = ctx.createRadialGradient(
      w * 0.78 + drift2,
      h * 0.18,
      0,
      w * 0.78 + drift2,
      h * 0.18,
      Math.max(w, h) * 0.6,
    );
    band2.addColorStop(0, hexToRgba(theme.horizon, 0.18));
    band2.addColorStop(0.45, hexToRgba(theme.horizon, 0.05));
    band2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = band2;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawMoon(ctx: CanvasRenderingContext2D, w: number, h: number, theme: ThemeDef, time: number): void {
    // Big setting "moon" — anchored to the right side, rises slowly with altitude
    // implicitly because it's screen-space.
    const cx = w * 0.74;
    const cy = h * 0.34;
    const r = Math.min(w, h) * 0.16;
    const breathe = 1 + Math.sin(time * 0.012) * 0.012;

    ctx.save();
    // Bloom halo
    const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 3.2);
    halo.addColorStop(0, hexToRgba(theme.horizon, 0.32));
    halo.addColorStop(0.4, hexToRgba(theme.horizon, 0.12));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - r * 3.4, cy - r * 3.4, r * 6.8, r * 6.8);

    // Moon body — gradient disc with horizon-line silhouette band.
    const disc = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    disc.addColorStop(0, lighten(theme.horizon, 0.45));
    disc.addColorStop(0.55, theme.horizon);
    disc.addColorStop(1, darken(theme.horizon, 0.35));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(cx, cy, r * breathe, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal silhouette stripes — gives the moon a synthwave-poster vibe.
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5; i++) {
      const yy = cy + r * (0.18 + i * 0.16);
      const thickness = 2 + i * 0.6;
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(cx - r, yy, r * 2, thickness);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  private drawStars(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    camera: Camera,
    theme: ThemeDef,
    time: number,
  ): void {
    const camY = camera.position.y;
    const camX = camera.position.x;
    ctx.save();
    for (const s of this.stars) {
      const px = ((s.x - camX * (1 - s.z) * 0.05) % w + w) % w;
      const py = ((s.y - camY * (1 - s.z) * 0.05) % h + h) % h;
      const horizon = h * 0.74;
      if (py > horizon) continue;
      const tw = 0.55 + Math.sin(time * 0.04 + s.twinkle) * 0.45;
      const alpha = (0.45 + 0.55 * s.z) * tw;
      const color = s.hue < 0.65 ? theme.star : s.hue < 0.85 ? theme.accent : theme.horizon;

      // Glow for larger stars.
      if (s.size >= 2.2) {
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.fillRect(px - s.size / 2, py - s.size / 2, s.size, s.size);
      } else {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, s.size, s.size);
      }
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private updateAndDrawShootingStars(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.shootingStarCooldown -= 1;
    if (this.shootingStarCooldown <= 0) {
      this.shootingStars.push({
        x: this.rng.next() * w * 0.6,
        y: this.rng.next() * h * 0.4,
        vx: 6 + this.rng.next() * 4,
        vy: 1.4 + this.rng.next() * 1.6,
        life: 1,
        maxLife: 1,
      });
      this.shootingStarCooldown = 360 + this.rng.next() * 600;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const s = this.shootingStars[i]!;
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.018;
      if (s.life <= 0 || s.x > w + 80 || s.y > h + 80) {
        this.shootingStars.splice(i, 1);
        continue;
      }
      const a = Math.max(0, s.life / s.maxLife);
      const tailLen = 60 + (1 - a) * 30;
      const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * tailLen / 6, s.y - s.vy * tailLen / 6);
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * tailLen / 6, s.y - s.vy * tailLen / 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHorizonGlow(ctx: CanvasRenderingContext2D, w: number, h: number, theme: ThemeDef, time: number): void {
    const horizonY = h * 0.74;
    const grad = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 30);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, hexToRgba(theme.horizon, 0.34));
    grad.addColorStop(1, hexToRgba(theme.horizon, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY - 40, w, 70);
    // Thin pulsing horizon line
    const pulse = 0.55 + Math.sin(time * 0.06) * 0.25;
    ctx.fillStyle = hexToRgba(theme.horizon, 0.75 * pulse);
    ctx.fillRect(0, horizonY, w, 1.2);
    ctx.restore();
  }

  private drawCityFar(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    camera: Camera,
    theme: ThemeDef,
    lowQuality: boolean,
  ): void {
    const horizonY = h * 0.74;
    const parallax = camera.position.x * 0.04;
    ctx.save();
    ctx.fillStyle = theme.cityFar;
    let x = 0;
    let idx = 0;
    while (x < w + 80) {
      const b = this.cityFar[idx % this.cityFar.length]!;
      const bw = b.w * 0.85;
      const bh = b.h * 0.6;
      const drawX = ((x - parallax) % (w + 200) + (w + 200)) % (w + 200) - 100;
      ctx.fillRect(drawX, horizonY - bh, bw, bh);
      if (!lowQuality) {
        this.drawWindows(ctx, drawX, horizonY - bh, bw, bh, b.windowSeed, theme.accent, 0.18, 2);
      }
      x += bw + 4;
      idx += 1;
    }
    ctx.restore();
  }

  private drawCityNear(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    camera: Camera,
    theme: ThemeDef,
    lowQuality: boolean,
  ): void {
    const horizonY = h * 0.74;
    const parallax = camera.position.x * 0.1;
    ctx.save();
    ctx.fillStyle = theme.cityNear;
    let x = 0;
    let idx = 0;
    while (x < w + 80) {
      const b = this.cityNear[idx % this.cityNear.length]!;
      const bw = b.w;
      const bh = b.h * 0.9;
      const drawX = ((x - parallax) % (w + 240) + (w + 240)) % (w + 240) - 120;
      ctx.fillRect(drawX, horizonY - bh + 24, bw, bh);
      if (!lowQuality) {
        this.drawWindows(
          ctx,
          drawX,
          horizonY - bh + 24,
          bw,
          bh,
          b.windowSeed,
          theme.horizon,
          0.42,
          3,
        );
        // Antenna / spire on roof for variety
        if ((idx + Math.floor(b.windowSeed * 100)) % 5 === 0) {
          ctx.fillStyle = hexToRgba(theme.horizon, 0.55);
          ctx.fillRect(drawX + bw / 2 - 0.5, horizonY - bh + 8, 1, 16);
          ctx.fillStyle = theme.horizon;
          ctx.fillRect(drawX + bw / 2 - 1.5, horizonY - bh + 8, 3, 3);
          ctx.fillStyle = theme.cityNear;
        }
      }
      x += bw + 6;
      idx += 1;
    }
    ctx.restore();
  }

  private drawWindows(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    seed: number,
    color: string,
    alpha: number,
    size: number,
  ): void {
    // Cheap deterministic window pattern. Uses bit shuffling so it always
    // looks the same per building without storing per-cell data.
    const cols = Math.max(2, Math.floor(w / (size + 2)));
    const rows = Math.max(3, Math.floor(h / (size + 3)));
    const sx = (w - cols * (size + 1)) / 2;
    const sy = 3;
    const seedInt = Math.floor(seed * 100000) | 0;
    ctx.fillStyle = hexToRgba(color, alpha);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bit = ((seedInt * 73 + r * 17 + c * 31) ^ (seedInt >> 3)) & 7;
        if (bit > 4) continue;
        ctx.fillRect(
          Math.round(x + sx + c * (size + 1)),
          Math.round(y + sy + r * (size + 2)),
          size,
          size,
        );
      }
    }
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    camera: Camera,
    theme: ThemeDef,
    time: number,
    lowQuality: boolean,
  ): void {
    const gridY = h * 0.82;
    ctx.save();
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    if (!lowQuality) {
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 6;
    }
    // Scroll the horizontal grid lines toward the viewer.
    const scroll = (time * 0.6) % 24;
    for (let i = 0; i < 22; i++) {
      const t = i / 22 + scroll / 24 / 22;
      const yy = gridY + Math.pow(t, 1.8) * (h - gridY) * 1.4;
      if (yy > h) break;
      ctx.globalAlpha = 0.25 + (1 - t) * 0.55;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
    const vanishX = w / 2;
    const camOffset = (camera.position.x * 0.06) % (w / 16);
    for (let i = -12; i <= 12; i++) {
      const lx = vanishX + i * (w / 16) - camOffset;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(lx, gridY);
      ctx.lineTo(vanishX + (lx - vanishX) * 6, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

