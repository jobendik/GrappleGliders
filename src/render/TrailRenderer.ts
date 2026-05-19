import type { TrailDef } from '../content/trails';
import { Vec2 } from '../game/Physics';
import { withAlpha } from '../utils/color';

interface TrailPoint {
  pos: Vec2;
  life: number;
  colorIndex: number;
}

export class TrailRenderer {
  private points: TrailPoint[] = [];
  private maxPoints = 48;
  private accum = 0;

  reset(): void {
    this.points.length = 0;
  }

  push(x: number, y: number, def: TrailDef, dt: number): void {
    this.accum += dt;
    if (this.accum < 0.45) return;
    this.accum = 0;
    const colorIdx = this.points.length % def.colors.length;
    this.points.push({ pos: new Vec2(x, y), life: 1, colorIndex: colorIdx });
    if (this.points.length > this.maxPoints) this.points.shift();
  }

  update(dt: number, def: TrailDef): void {
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i]!;
      p.life -= def.fade * dt;
      if (p.life <= 0) this.points.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, def: TrailDef, lowQuality: boolean): void {
    if (this.points.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Additive layering produces a soft volumetric trail without expensive
    // per-segment shadow blur.
    ctx.globalCompositeOperation = 'lighter';

    if (!lowQuality) {
      // Outer halo pass — wider, lower alpha.
      ctx.beginPath();
      ctx.moveTo(this.points[0]!.pos.x, this.points[0]!.pos.y);
      for (let i = 1; i < this.points.length; i++) {
        ctx.lineTo(this.points[i]!.pos.x, this.points[i]!.pos.y);
      }
      ctx.lineWidth = 8;
      ctx.strokeStyle = withAlpha(def.colors[0]!, 0.18);
      ctx.shadowColor = def.colors[0]!;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Core gradient strokes — segmented so we can color-bleed along the trail.
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]!;
      const b = this.points[i]!;
      const alpha = Math.max(0, b.life);
      const color = def.colors[b.colorIndex % def.colors.length]!;
      const grad = ctx.createLinearGradient(a.pos.x, a.pos.y, b.pos.x, b.pos.y);
      grad.addColorStop(0, withAlpha(color, alpha * 0.45));
      grad.addColorStop(1, withAlpha(color, alpha * 0.95));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6 + b.life * 4.4;
      ctx.beginPath();
      ctx.moveTo(a.pos.x, a.pos.y);
      ctx.lineTo(b.pos.x, b.pos.y);
      ctx.stroke();
    }

    // Bright hot core on the freshest segments.
    if (this.points.length >= 2) {
      const tail = Math.min(8, this.points.length - 1);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(
        this.points[this.points.length - 1 - tail]!.pos.x,
        this.points[this.points.length - 1 - tail]!.pos.y,
      );
      for (let i = this.points.length - tail; i < this.points.length; i++) {
        const p = this.points[i]!;
        ctx.globalAlpha = Math.max(0, p.life) * 0.7;
        ctx.lineTo(p.pos.x, p.pos.y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

