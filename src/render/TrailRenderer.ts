import type { TrailDef } from '../content/trails';
import { Vec2 } from '../game/Physics';

interface TrailPoint {
  pos: Vec2;
  life: number;
  colorIndex: number;
}

export class TrailRenderer {
  private points: TrailPoint[] = [];
  private maxPoints = 36;
  private accum = 0;

  reset(): void {
    this.points.length = 0;
  }

  push(x: number, y: number, def: TrailDef, dt: number): void {
    this.accum += dt;
    if (this.accum < 0.6) return;
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
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]!;
      const b = this.points[i]!;
      const alpha = Math.max(0, b.life);
      const color = def.colors[b.colorIndex % def.colors.length]!;
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha * 0.8;
      ctx.lineWidth = 1.4 + b.life * 4;
      if (!lowQuality) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10 * alpha;
      }
      ctx.beginPath();
      ctx.moveTo(a.pos.x, a.pos.y);
      ctx.lineTo(b.pos.x, b.pos.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
