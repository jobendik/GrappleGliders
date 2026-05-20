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
  /** Whether this building has a roof beacon (red blinker). */
  beacon: boolean;
}

interface FogCloud {
  /** Screen-space horizontal anchor (0..1). */
  ux: number;
  /** Screen-space vertical anchor (0..1). */
  uy: number;
  /** Size in pixels. */
  r: number;
  /** Drift phase. */
  phase: number;
  /** Drift speed. */
  speed: number;
  /** Color preference: 0=accent, 1=horizon. */
  tint: number;
}

interface Satellite {
  x: number;
  y: number;
  vx: number;
  vy: number;
  blink: number;
  /** Lifetime in frames. */
  ttl: number;
}

interface EnergyRibbon {
  /** Screen-space anchor (0..1). */
  uy: number;
  /** Color tint (0=accent, 1=horizon). */
  tint: number;
  /** Speed of flow scroll. */
  speed: number;
  /** Phase offset. */
  phase: number;
  /** Amplitude of vertical wave. */
  amp: number;
}

export class ParallaxBackground {
  private stars: Star[] = [];
  private cityFar: CityBuilding[] = [];
  private cityNear: CityBuilding[] = [];
  private shootingStars: ShootingStar[] = [];
  private shootingStarCooldown = 0;
  private rng = new SeededRandom(1337);
  private fogClouds: FogCloud[] = [];
  private satellites: Satellite[] = [];
  private satelliteCooldown = 900;
  /** Lightning flash strength 0..1, decays each frame. */
  private lightningFlash = 0;
  /** Frames until next lightning attempt. */
  private lightningCooldown = 600;
  /** Lightning bolt path points (when active). */
  private lightningBolt: { x: number; y: number }[] = [];
  private lightningBoltTtl = 0;
  /** Energy ribbons that flow across the sky at high altitudes. */
  private energyRibbons: EnergyRibbon[] = [];
  /** Combo-driven aurora intensity multiplier 0..1. */
  comboBoost = 0;

  init(width: number, height: number): void {
    this.stars.length = 0;
    const count = 220;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: this.rng.next() * width,
        y: this.rng.next() * height,
        z: 0.3 + this.rng.next() * 0.7,
        size: this.rng.next() < 0.78 ? 1.2 : this.rng.next() < 0.94 ? 2.2 : 3.2,
        twinkle: this.rng.next() * Math.PI * 2,
        hue: this.rng.next(),
      });
    }
    this.cityFar = Array.from({ length: 36 }, () => ({
      w: this.rng.range(24, 56),
      h: this.rng.range(40, 130),
      windowSeed: this.rng.next(),
      beacon: this.rng.next() < 0.18,
    }));
    this.cityNear = Array.from({ length: 28 }, () => ({
      w: this.rng.range(34, 86),
      h: this.rng.range(80, 220),
      windowSeed: this.rng.next(),
      beacon: this.rng.next() < 0.32,
    }));
    this.fogClouds = Array.from({ length: 5 }, () => ({
      ux: this.rng.next(),
      uy: 0.45 + this.rng.next() * 0.35,
      r: 180 + this.rng.next() * 220,
      phase: this.rng.next() * Math.PI * 2,
      speed: 0.0008 + this.rng.next() * 0.0014,
      tint: this.rng.next(),
    }));
    this.shootingStars = [];
    this.shootingStarCooldown = 220;
    this.satellites = [];
    this.satelliteCooldown = 900;
    this.energyRibbons = Array.from({ length: 3 }, () => ({
      uy: 0.15 + this.rng.next() * 0.35,
      tint: this.rng.next(),
      speed: 0.002 + this.rng.next() * 0.003,
      phase: this.rng.next() * Math.PI * 2,
      amp: 18 + this.rng.next() * 14,
    }));
    this.lightningFlash = 0;
    this.lightningCooldown = 480 + this.rng.next() * 480;
    this.lightningBolt = [];
    this.lightningBoltTtl = 0;
    this.comboBoost = 0;
  }

  draw(renderer: Renderer, camera: Camera, theme: ThemeDef, time: number, lowQuality: boolean): void {
    const ctx = renderer.ctx;
    const w = renderer.cssWidth;
    const h = renderer.cssHeight;
    // Altitude factor 0..1: 0 at ground, 1 near 3000m+. Camera y is negative
    // when up. Drives sky deepening, planet visibility, ribbons.
    const altitude = Math.max(0, Math.min(1, -camera.position.y / 30000));

    this.drawSky(ctx, w, h, theme, time, altitude);
    if (lowQuality) {
      this.drawStarsSimple(ctx, w, h, camera, theme);
      this.drawCityFar(ctx, w, h, camera, theme, true);
      this.drawCityNear(ctx, w, h, camera, theme, true);
      this.drawGrid(ctx, w, h, camera, theme, time, true);
      return;
    }

    this.drawAurora(ctx, w, h, theme, time);
    this.drawNebula(ctx, w, h, theme, time);
    this.drawDistantPlanet(ctx, w, h, theme, time, altitude);
    this.drawMoon(ctx, w, h, theme, time);
    this.drawStars(ctx, w, h, camera, theme, time);
    this.updateAndDrawShootingStars(ctx, w, h);
    this.updateAndDrawSatellites(ctx, w, h);
    this.drawEnergyRibbons(ctx, w, h, theme, time, altitude);
    this.updateAndDrawLightning(ctx, w, h, theme, altitude);
    this.drawFogClouds(ctx, w, h, theme, time);
    this.drawCityFar(ctx, w, h, camera, theme, false);
    this.drawHorizonGlow(ctx, w, h, theme, time);
    this.drawCityNear(ctx, w, h, camera, theme, false);
    this.drawCityReflection(ctx, w, h, camera, theme, time);
    this.drawGrid(ctx, w, h, camera, theme, time, false);
  }

  private drawSky(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: ThemeDef,
    _time: number,
    altitude: number,
  ): void {
    // Vertical sky gradient with an extra subtle radial vignette baked in for
    // depth. The gradient is computed once per frame; the radial pass is light.
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(0.5, theme.skyMid);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Altitude-driven deepening: as we climb, the sky goes blacker and more
    // cosmic. Subtle but sells the sense of altitude.
    if (altitude > 0.05) {
      ctx.fillStyle = `rgba(0,0,0,${altitude * 0.45})`;
      ctx.fillRect(0, 0, w, h * 0.7);
    }

    // Lightning flash brightens the whole sky briefly.
    if (this.lightningFlash > 0.01) {
      const a = this.lightningFlash * 0.55;
      ctx.fillStyle = `rgba(${this.themeRgbAccent(theme).join(',')},${a})`;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Soft radial darkening from edges in — pushes attention to the center.
    const vignette = ctx.createRadialGradient(
      w / 2,
      h * 0.55,
      Math.min(w, h) * 0.2,
      w / 2,
      h * 0.55,
      Math.max(w, h) * 0.85,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  private themeRgbAccent(theme: ThemeDef): [number, number, number] {
    // Extract RGB from theme.accent hex.
    const h = theme.accent.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /**
   * Drifting aurora ribbons: 3 layered sin-band fills painted with
   * additive blending. Produces shimmering vertical light columns above the
   * horizon line — feels expensive, costs ~20 fillRects.
   * Intensity scales with current combo so a sustained chain lights up the sky.
   */
  private drawAurora(ctx: CanvasRenderingContext2D, w: number, h: number, theme: ThemeDef, time: number): void {
    const horizonY = h * 0.74;
    const boost = 1 + this.comboBoost * 1.8;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const layers = [
      { color: theme.accent, base: 0.55, freq: 0.0015, amp: 14, alpha: 0.12 * boost },
      { color: theme.horizon, base: 0.62, freq: 0.0019, amp: 18, alpha: 0.10 * boost },
      { color: theme.accent, base: 0.50, freq: 0.0011, amp: 10, alpha: 0.08 * boost },
    ];
    for (const layer of layers) {
      const bandH = h * 0.4;
      const topY = horizonY - bandH;
      const grad = ctx.createLinearGradient(0, topY, 0, horizonY);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.55, hexToRgba(layer.color, layer.alpha));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      // Slice into 18 vertical bands and wave their alpha to fake a shimmering
      // ribbon — much cheaper than per-pixel noise.
      const slices = 18;
      const sw = w / slices;
      for (let i = 0; i < slices; i++) {
        const x = i * sw;
        const wave = Math.sin(time * layer.freq + i * 0.6) * 0.5 + 0.5;
        const heightMod = layer.amp * Math.sin(time * 0.002 + i * 0.4);
        ctx.globalAlpha = layer.base * wave;
        ctx.fillRect(x, topY + heightMod, sw + 1, bandH);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
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
    band1.addColorStop(0, hexToRgba(theme.accent, 0.28));
    band1.addColorStop(0.4, hexToRgba(theme.accent, 0.08));
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
    band2.addColorStop(0, hexToRgba(theme.horizon, 0.22));
    band2.addColorStop(0.45, hexToRgba(theme.horizon, 0.06));
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
    // Outer mega halo
    ctx.globalCompositeOperation = 'screen';
    const megaHalo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 5.4);
    megaHalo.addColorStop(0, hexToRgba(theme.horizon, 0.22));
    megaHalo.addColorStop(0.3, hexToRgba(theme.horizon, 0.08));
    megaHalo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = megaHalo;
    ctx.fillRect(cx - r * 5.6, cy - r * 5.6, r * 11.2, r * 11.2);

    // Bloom halo
    const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 3.2);
    halo.addColorStop(0, hexToRgba(theme.horizon, 0.4));
    halo.addColorStop(0.4, hexToRgba(theme.horizon, 0.14));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - r * 3.4, cy - r * 3.4, r * 6.8, r * 6.8);
    ctx.globalCompositeOperation = 'source-over';

    // Moon body — gradient disc with horizon-line silhouette band.
    const disc = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    disc.addColorStop(0, lighten(theme.horizon, 0.5));
    disc.addColorStop(0.55, theme.horizon);
    disc.addColorStop(1, darken(theme.horizon, 0.4));
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

    // Crisp rim highlight at the top — adds "lit-by-something" depth.
    ctx.strokeStyle = hexToRgba(lighten(theme.horizon, 0.6), 0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * breathe, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
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
      const tw = Math.max(0.05, 0.45 + Math.sin(time * 0.04 + s.twinkle) * 0.55);
      const alpha = (0.45 + 0.55 * s.z) * tw;
      const color = s.hue < 0.65 ? theme.star : s.hue < 0.85 ? theme.accent : theme.horizon;

      // Big stars get a soft halo + 4-pointed glint for cinematic feel.
      if (s.size >= 3.0) {
        ctx.globalCompositeOperation = 'screen';
        const haloR = Math.max(0.5, 8 * tw);
        const halo = ctx.createRadialGradient(px, py, 0, px, py, haloR);
        halo.addColorStop(0, hexToRgba(color, alpha * 0.9));
        halo.addColorStop(0.5, hexToRgba(color, alpha * 0.25));
        halo.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(px, py, haloR, 0, Math.PI * 2);
        ctx.fill();
        // Tiny 4-pointed sparkle
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.6;
        const len = 4 + tw * 3;
        ctx.beginPath();
        ctx.moveTo(px - len, py);
        ctx.lineTo(px + len, py);
        ctx.moveTo(px, py - len);
        ctx.lineTo(px, py + len);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha;
        ctx.fillRect(px - 0.6, py - 0.6, 1.2, 1.2);
      } else if (s.size >= 2.2) {
        ctx.globalAlpha = alpha * 0.7;
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

  /** Low-quality fallback: just plain twinkly dots, no halos. */
  private drawStarsSimple(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    camera: Camera,
    theme: ThemeDef,
  ): void {
    const camY = camera.position.y;
    const camX = camera.position.x;
    ctx.save();
    for (const s of this.stars) {
      const px = ((s.x - camX * (1 - s.z) * 0.05) % w + w) % w;
      const py = ((s.y - camY * (1 - s.z) * 0.05) % h + h) % h;
      const horizon = h * 0.74;
      if (py > horizon) continue;
      ctx.globalAlpha = 0.6 * s.z;
      ctx.fillStyle = s.hue < 0.7 ? theme.star : theme.accent;
      ctx.fillRect(px, py, s.size, s.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private updateAndDrawShootingStars(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.shootingStarCooldown -= 1;
    if (this.shootingStarCooldown <= 0) {
      this.shootingStars.push({
        x: this.rng.next() * w * 0.6,
        y: this.rng.next() * h * 0.4,
        vx: 6 + this.rng.next() * 5,
        vy: 1.4 + this.rng.next() * 1.8,
        life: 1,
        maxLife: 1,
      });
      this.shootingStarCooldown = 220 + this.rng.next() * 480;
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
      const tailLen = 80 + (1 - a) * 40;
      const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * tailLen / 6, s.y - s.vy * tailLen / 6);
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(0.45, `rgba(180,220,255,${a * 0.6})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * tailLen / 6, s.y - s.vy * tailLen / 6);
      ctx.stroke();
      // Bright head
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.6 * a + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Slow blinking satellites that drift across the upper sky. */
  private updateAndDrawSatellites(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.satelliteCooldown -= 1;
    if (this.satelliteCooldown <= 0 && this.satellites.length < 2) {
      this.satellites.push({
        x: -10,
        y: h * (0.12 + this.rng.next() * 0.3),
        vx: 0.4 + this.rng.next() * 0.3,
        vy: this.rng.next() < 0.5 ? -0.04 : 0.04,
        blink: this.rng.next() * Math.PI * 2,
        ttl: w * 4,
      });
      this.satelliteCooldown = 900 + this.rng.next() * 1800;
    }
    ctx.save();
    for (let i = this.satellites.length - 1; i >= 0; i--) {
      const s = this.satellites[i]!;
      s.x += s.vx;
      s.y += s.vy;
      s.ttl -= 1;
      s.blink += 0.05;
      if (s.x > w + 20 || s.ttl <= 0) {
        this.satellites.splice(i, 1);
        continue;
      }
      const blinkOn = (Math.floor(s.blink) % 4) === 0;
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.x - 0.6, s.y - 0.6, 1.2, 1.2);
      if (blinkOn) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(s.x - 0.5, s.y - 0.5, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Drifting volumetric fog/cloud bands above the horizon. */
  private drawFogClouds(ctx: CanvasRenderingContext2D, w: number, h: number, theme: ThemeDef, time: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const c of this.fogClouds) {
      const driftX = Math.sin(time * c.speed + c.phase) * 60;
      const x = c.ux * w + driftX;
      const y = c.uy * h;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, c.r);
      const tint = c.tint < 0.5 ? theme.accent : theme.horizon;
      grad.addColorStop(0, hexToRgba(tint, 0.16));
      grad.addColorStop(0.4, hexToRgba(tint, 0.06));
      grad.addColorStop(1, hexToRgba(tint, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Distant rotating planet that fades in as the player climbs higher. Adds
   * "you're in space" payoff at high altitude.
   */
  private drawDistantPlanet(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: ThemeDef,
    time: number,
    altitude: number,
  ): void {
    if (altitude < 0.08) return;
    const visibility = Math.min(1, (altitude - 0.08) * 2.5);
    const cx = w * 0.18;
    const cy = h * 0.22;
    const r = Math.min(w, h) * 0.08;
    ctx.save();
    ctx.globalAlpha = visibility;
    // Outer glow ring
    ctx.globalCompositeOperation = 'screen';
    const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.2);
    halo.addColorStop(0, hexToRgba(theme.accent, 0.25));
    halo.addColorStop(0.5, hexToRgba(theme.accent, 0.08));
    halo.addColorStop(1, hexToRgba(theme.accent, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // Planet body — gradient with terminator (light/shadow side).
    const disc = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    disc.addColorStop(0, lighten(theme.accent, 0.4));
    disc.addColorStop(0.45, theme.accent);
    disc.addColorStop(0.85, darken(theme.accent, 0.45));
    disc.addColorStop(1, '#04040a');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Faint orbital ring rotating
    ctx.strokeStyle = hexToRgba(theme.accent, 0.32);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.45, r * 0.45, time * 0.005, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Energy ribbons flowing horizontally across the sky at high altitudes —
   * adds dynamism and signals the world has more layers above.
   */
  private drawEnergyRibbons(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: ThemeDef,
    time: number,
    altitude: number,
  ): void {
    const visibility = Math.min(1, altitude * 1.8);
    if (visibility < 0.05) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const r of this.energyRibbons) {
      const baseY = r.uy * h;
      const color = r.tint < 0.5 ? theme.accent : theme.horizon;
      // Draw the ribbon as a series of horizontal segments following a sine wave.
      const segments = 18;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * w;
        const y = baseY + Math.sin(time * r.speed + r.phase + i * 0.6) * r.amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hexToRgba(color, 0.35 * visibility);
      ctx.lineWidth = 6;
      ctx.stroke();
      // Bright thin core
      ctx.strokeStyle = hexToRgba(color, 0.85 * visibility);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Flowing pulse bead along the ribbon
      const beadT = (time * 0.012 + r.phase * 0.16) % 1;
      const beadX = beadT * w;
      const beadY = baseY + Math.sin(time * r.speed + r.phase + (beadT * segments) * 0.6) * r.amp;
      const bead = ctx.createRadialGradient(beadX, beadY, 0, beadX, beadY, 8);
      bead.addColorStop(0, '#ffffff');
      bead.addColorStop(0.5, hexToRgba(color, 0.7 * visibility));
      bead.addColorStop(1, hexToRgba(color, 0));
      ctx.fillStyle = bead;
      ctx.beginPath();
      ctx.arc(beadX, beadY, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Occasional dramatic lightning bolt in the upper sky. Frequency ramps up
   * with altitude. Produces a brief full-sky white flash plus a jagged bolt.
   */
  private updateAndDrawLightning(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: ThemeDef,
    altitude: number,
  ): void {
    // Decay current flash.
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - 0.04);
    }
    if (this.lightningBoltTtl > 0) {
      this.lightningBoltTtl -= 1;
    }

    // Spawn a new bolt occasionally — rarer at low altitude.
    this.lightningCooldown -= 1;
    if (this.lightningCooldown <= 0) {
      const rate = 0.3 + altitude * 0.7;
      if (this.rng.next() < rate) {
        this.lightningFlash = 0.85;
        this.lightningBoltTtl = 14;
        // Build a jagged bolt path.
        const startX = this.rng.range(w * 0.15, w * 0.85);
        const segments = 8;
        const totalLen = h * 0.55;
        this.lightningBolt = [];
        let x = startX;
        let y = 0;
        for (let i = 0; i <= segments; i++) {
          this.lightningBolt.push({ x, y });
          const stepY = totalLen / segments;
          const jitter = (this.rng.next() - 0.5) * 60;
          x += jitter;
          y += stepY;
        }
      }
      this.lightningCooldown = 280 + this.rng.next() * 540;
    }

    // Draw the bolt while alive.
    if (this.lightningBoltTtl > 0 && this.lightningBolt.length >= 2) {
      const t = this.lightningBoltTtl / 14;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Outer glow stroke
      ctx.beginPath();
      ctx.moveTo(this.lightningBolt[0]!.x, this.lightningBolt[0]!.y);
      for (let i = 1; i < this.lightningBolt.length; i++) {
        ctx.lineTo(this.lightningBolt[i]!.x, this.lightningBolt[i]!.y);
      }
      ctx.strokeStyle = hexToRgba(theme.horizon, 0.55 * t);
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Bright inner core
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * t})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawHorizonGlow(ctx: CanvasRenderingContext2D, w: number, h: number, theme: ThemeDef, time: number): void {
    const horizonY = h * 0.74;
    const grad = ctx.createLinearGradient(0, horizonY - 60, 0, horizonY + 30);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, hexToRgba(theme.horizon, 0.42));
    grad.addColorStop(1, hexToRgba(theme.horizon, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY - 60, w, 90);
    // Thin pulsing horizon line
    const pulse = 0.55 + Math.sin(time * 0.06) * 0.25;
    ctx.fillStyle = hexToRgba(theme.horizon, 0.85 * pulse);
    ctx.fillRect(0, horizonY, w, 1.4);
    // Inner brighter pulse line just below
    ctx.fillStyle = hexToRgba('#ffffff', 0.4 * pulse);
    ctx.fillRect(0, horizonY + 0.4, w, 0.6);
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
        this.drawWindows(ctx, drawX, horizonY - bh, bw, bh, b.windowSeed, theme.accent, 0.22, 2);
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
          0.5,
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
        // Beacon — slow red blinker on top of some buildings.
        if (b.beacon) {
          const beaconPhase = Math.sin(performance.now() * 0.003 + b.windowSeed * 17);
          if (beaconPhase > 0) {
            const beaconX = drawX + bw - 4;
            const beaconY = horizonY - bh + 22;
            const beaconAlpha = 0.5 + beaconPhase * 0.5;
            ctx.fillStyle = hexToRgba('#ff4444', beaconAlpha);
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(beaconX, beaconY, 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = theme.cityNear;
          }
        }
      }
      x += bw + 6;
      idx += 1;
    }
    ctx.restore();
  }

  /**
   * Faint inverted-color mirror of the city below the horizon, evoking a
   * reflective water/glass surface. Cheap (small alpha fillRect strokes).
   */
  private drawCityReflection(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    camera: Camera,
    theme: ThemeDef,
    time: number,
  ): void {
    const horizonY = h * 0.74;
    const parallax = camera.position.x * 0.1;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    let x = 0;
    let idx = 0;
    while (x < w + 80) {
      const b = this.cityNear[idx % this.cityNear.length]!;
      const bw = b.w;
      const bh = b.h * 0.9;
      const drawX = ((x - parallax) % (w + 240) + (w + 240)) % (w + 240) - 120;
      // Reflection is a soft vertical gradient below horizon line.
      const reflH = Math.min(bh * 0.35, 60);
      const grad = ctx.createLinearGradient(0, horizonY, 0, horizonY + reflH);
      const shimmer = 0.18 + Math.sin(time * 0.04 + idx * 0.4) * 0.04;
      grad.addColorStop(0, hexToRgba(theme.horizon, shimmer));
      grad.addColorStop(1, hexToRgba(theme.horizon, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(drawX, horizonY, bw, reflH);
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
    // Subtle per-window "lit" twinkle: flicker pulse cycles based on a global timer.
    const t = performance.now() * 0.001;
    ctx.fillStyle = hexToRgba(color, alpha);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bit = ((seedInt * 73 + r * 17 + c * 31) ^ (seedInt >> 3)) & 7;
        if (bit > 4) continue;
        // Every ~64th window twinkles brighter than the rest.
        const cellHash = (seedInt + r * 53 + c * 11) & 63;
        const isTwinkle = cellHash === 7;
        if (isTwinkle) {
          const flick = 0.5 + Math.sin(t * 4 + cellHash) * 0.5;
          ctx.fillStyle = hexToRgba(color, Math.min(0.95, alpha + flick * 0.5));
        }
        ctx.fillRect(
          Math.round(x + sx + c * (size + 1)),
          Math.round(y + sy + r * (size + 2)),
          size,
          size,
        );
        if (isTwinkle) ctx.fillStyle = hexToRgba(color, alpha);
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
      ctx.globalAlpha = 0.25 + (1 - t) * 0.65;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
    const vanishX = w / 2;
    const camOffset = (camera.position.x * 0.06) % (w / 16);
    for (let i = -12; i <= 12; i++) {
      const lx = vanishX + i * (w / 16) - camOffset;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(lx, gridY);
      ctx.lineTo(vanishX + (lx - vanishX) * 6, h);
      ctx.stroke();
    }
    // Bright leading edge — emphasizes the horizon line where grid starts.
    if (!lowQuality) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, gridY);
      ctx.lineTo(w, gridY);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
