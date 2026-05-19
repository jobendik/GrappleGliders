import type { GrapplingHook } from '../game/GrapplingHook';
import type { HookDef } from '../content/hooks';
import { Vec2 } from '../game/Physics';

export class HookRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    hook: GrapplingHook,
    playerPos: Vec2,
    def: HookDef,
    time: number,
    lowQuality: boolean,
  ): void {
    if (hook.state === 'idle') return;
    const start = playerPos;
    const end = hook.position;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    ctx.save();
    ctx.lineCap = 'round';

    switch (def.rope) {
      case 'cable':
      case 'chain':
      case 'plasma':
      case 'thread':
      case 'silk':
        this.drawCable(ctx, start, end, def, lowQuality);
        break;
      case 'laser':
        this.drawLaser(ctx, start, end, def, time, lowQuality);
        break;
      case 'vine':
        this.drawVine(ctx, start, end, def, time, lowQuality);
        break;
      case 'lightning':
        this.drawLightning(ctx, start, end, def, time, lowQuality);
        break;
    }

    // Anchor sparkle on attach
    if (hook.state === 'attached') {
      const pulse = 0.6 + Math.sin(time * 0.2) * 0.4;
      ctx.fillStyle = def.color;
      if (!lowQuality) {
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 18 * pulse;
      }
      ctx.beginPath();
      ctx.arc(end.x, end.y, 5 + pulse * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  private drawCable(
    ctx: CanvasRenderingContext2D,
    start: Vec2,
    end: Vec2,
    def: HookDef,
    lowQuality: boolean,
  ): void {
    if (!lowQuality) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
    }
    ctx.strokeStyle = def.color;
    ctx.lineWidth = def.width;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private drawLaser(
    ctx: CanvasRenderingContext2D,
    start: Vec2,
    end: Vec2,
    def: HookDef,
    time: number,
    lowQuality: boolean,
  ): void {
    const flicker = 0.6 + Math.sin(time * 0.5) * 0.2;
    ctx.strokeStyle = `rgba(255,255,255,${flicker})`;
    ctx.lineWidth = def.width * 0.8;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    if (!lowQuality) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 16;
    }
    ctx.strokeStyle = def.color;
    ctx.lineWidth = def.width * 2.4;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  private drawVine(
    ctx: CanvasRenderingContext2D,
    start: Vec2,
    end: Vec2,
    def: HookDef,
    time: number,
    lowQuality: boolean,
  ): void {
    const segments = 14;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = def.width;
    if (!lowQuality) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const nx = -dy;
    const ny = dx;
    const len = Math.hypot(nx, ny);
    const ux = len > 0 ? nx / len : 0;
    const uy = len > 0 ? ny / len : 0;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const wave = Math.sin(t * Math.PI * 4 + time * 0.2) * 6 * Math.sin(t * Math.PI);
      const px = start.x + dx * t + ux * wave;
      const py = start.y + dy * t + uy * wave;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private drawLightning(
    ctx: CanvasRenderingContext2D,
    start: Vec2,
    end: Vec2,
    def: HookDef,
    time: number,
    lowQuality: boolean,
  ): void {
    const segments = 12;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = def.width;
    if (!lowQuality) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const nx = -dy;
    const ny = dx;
    const len = Math.hypot(nx, ny);
    const ux = len > 0 ? nx / len : 0;
    const uy = len > 0 ? ny / len : 0;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jitter = (Math.sin(i * 17 + time) * 0.5 + (Math.random() - 0.5)) * 4;
      const px = start.x + dx * t + ux * jitter;
      const py = start.y + dy * t + uy * jitter;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
