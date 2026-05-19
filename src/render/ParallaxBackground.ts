import { SeededRandom } from '../utils/seededRandom';
import type { ThemeDef } from '../content/themes';
import type { Renderer } from './Renderer';
import type { Camera } from '../game/Camera';

interface Star {
  x: number;
  y: number;
  z: number; // 0..1 — 0 = nearest, 1 = farthest
  size: number;
  twinkle: number;
}

export class ParallaxBackground {
  private stars: Star[] = [];
  private cityFarOffsets: number[] = [];
  private cityNearOffsets: number[] = [];
  private rng = new SeededRandom(1337);

  init(width: number, height: number): void {
    this.stars.length = 0;
    const count = 140;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: this.rng.next() * width,
        y: this.rng.next() * height,
        z: 0.3 + this.rng.next() * 0.7,
        size: this.rng.next() < 0.85 ? 1.4 : 2.2,
        twinkle: this.rng.next() * Math.PI * 2,
      });
    }
    this.cityFarOffsets = Array.from({ length: 30 }, () => this.rng.range(20, 110));
    this.cityNearOffsets = Array.from({ length: 22 }, () => this.rng.range(30, 160));
  }

  draw(renderer: Renderer, camera: Camera, theme: ThemeDef, time: number, lowQuality: boolean): void {
    const ctx = renderer.ctx;
    const w = renderer.cssWidth;
    const h = renderer.cssHeight;
    // Sky gradient.
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(0.5, theme.skyMid);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (lowQuality) return;

    // Stars (only the ones above the horizon).
    const camY = camera.position.y;
    const camX = camera.position.x;
    for (const s of this.stars) {
      const px = ((s.x - camX * (1 - s.z) * 0.05) % w + w) % w;
      const py = ((s.y - camY * (1 - s.z) * 0.05) % h + h) % h;
      const horizon = h * 0.78;
      if (py > horizon) continue;
      const tw = 0.55 + Math.sin(time * 0.04 + s.twinkle) * 0.45;
      ctx.fillStyle = theme.star;
      ctx.globalAlpha = (0.4 + 0.6 * s.z) * tw;
      ctx.fillRect(px, py, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // Distant cityscape silhouette.
    const horizonY = h * 0.74;
    const cityFarParallax = camX * 0.04;
    ctx.fillStyle = theme.cityFar;
    let x = 0;
    let idx = 0;
    while (x < w + 80) {
      const bw = 28 + this.cityFarOffsets[idx % this.cityFarOffsets.length]! * 0.4;
      const bh = this.cityFarOffsets[idx % this.cityFarOffsets.length]! * 0.6;
      ctx.fillRect((x - cityFarParallax) % w, horizonY - bh, bw, bh);
      ctx.fillRect(((x - cityFarParallax) % w) - w, horizonY - bh, bw, bh);
      x += bw + 4;
      idx += 1;
    }

    // Near cityscape silhouette
    const cityNearParallax = camX * 0.1;
    ctx.fillStyle = theme.cityNear;
    x = 0;
    idx = 0;
    while (x < w + 80) {
      const bw = 36 + this.cityNearOffsets[idx % this.cityNearOffsets.length]! * 0.6;
      const bh = this.cityNearOffsets[idx % this.cityNearOffsets.length]! * 0.85;
      ctx.fillRect((x - cityNearParallax) % w, horizonY - bh + 24, bw, bh);
      ctx.fillRect(((x - cityNearParallax) % w) - w, horizonY - bh + 24, bw, bh);
      x += bw + 6;
      idx += 1;
    }

    // Retro grid horizon
    const gridY = h * 0.82;
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 16; i++) {
      const yy = gridY + i * (i * 1.5 + 4);
      if (yy > h) break;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
    const vanishX = w / 2;
    for (let i = -12; i <= 12; i++) {
      const lx = vanishX + i * (w / 16) - (camX * 0.06) % (w / 16);
      ctx.beginPath();
      ctx.moveTo(lx, gridY);
      ctx.lineTo(vanishX + (lx - vanishX) * 6, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
