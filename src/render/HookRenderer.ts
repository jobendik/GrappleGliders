import type { GrapplingHook } from '../game/GrapplingHook';
import type { HookDef } from '../content/hooks';
import { Vec2 } from '../game/Physics';
import { withAlpha } from '../utils/color';

export class HookRenderer {
  /** How long since the hook last attached (frames). Used to flash the anchor. */
  private lastAttachTime = -9999;
  private wasAttached = false;

  draw(
    ctx: CanvasRenderingContext2D,
    hook: GrapplingHook,
    playerPos: Vec2,
    playerVel: Vec2,
    def: HookDef,
    time: number,
    lowQuality: boolean,
  ): void {
    if (hook.state === 'idle') {
      this.wasAttached = false;
      return;
    }
    const start = playerPos;
    const end = hook.position;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    // Track attach event for the flash.
    if (hook.state === 'attached' && !this.wasAttached) {
      this.lastAttachTime = time;
      this.wasAttached = true;
    } else if (hook.state !== 'attached') {
      this.wasAttached = false;
    }

    // Tension: based on player velocity along rope direction when attached.
    let tension = 0;
    if (hook.state === 'attached') {
      const ux = dx / dist;
      const uy = dy / dist;
      const radial = playerVel.x * ux + playerVel.y * uy;
      tension = Math.min(1, Math.abs(radial) / 18);
    }

    ctx.save();
    ctx.lineCap = 'round';

    switch (def.rope) {
      case 'cable':
      case 'chain':
      case 'plasma':
      case 'thread':
      case 'silk':
        this.drawCable(ctx, start, end, def, tension, lowQuality);
        break;
      case 'laser':
        this.drawLaser(ctx, start, end, def, time, tension, lowQuality);
        break;
      case 'vine':
        this.drawVine(ctx, start, end, def, time, tension, lowQuality);
        break;
      case 'lightning':
        this.drawLightning(ctx, start, end, def, time, tension, lowQuality);
        break;
    }

    // Anchor visuals
    if (hook.state === 'attached') {
      const sinceAttach = time - this.lastAttachTime;
      const flashT = Math.max(0, 1 - sinceAttach / 14);
      // Impact ring just after attach
      if (flashT > 0 && !lowQuality) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = withAlpha(def.color, flashT);
        ctx.lineWidth = 2 + (1 - flashT) * 2;
        ctx.beginPath();
        ctx.arc(end.x, end.y, 6 + (1 - flashT) * 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // Persistent anchor pulse
      const pulse = 0.6 + Math.sin(time * 0.2) * 0.4;
      if (!lowQuality) {
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 16 * pulse;
      }
      const r = 4 + pulse * 1.4;
      const grad = ctx.createRadialGradient(end.x, end.y, 0, end.x, end.y, r * 3);
      grad.addColorStop(0, withAlpha(def.color, 0.9));
      grad.addColorStop(0.5, withAlpha(def.color, 0.35));
      grad.addColorStop(1, withAlpha(def.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(end.x, end.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(end.x, end.y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else if (hook.state === 'shooting') {
      // Bright trail head while shooting
      const grad = ctx.createRadialGradient(end.x, end.y, 0, end.x, end.y, 8);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, withAlpha(def.color, 0.9));
      grad.addColorStop(1, withAlpha(def.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(end.x, end.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawCable(
    ctx: CanvasRenderingContext2D,
    start: Vec2,
    end: Vec2,
    def: HookDef,
    tension: number,
    lowQuality: boolean,
  ): void {
    // Outer glow halo.
    if (!lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha(def.color, 0.25 + tension * 0.25);
      ctx.lineWidth = def.width + 4;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }
    // Core rope: gradient from player tone to anchor tone.
    const grad = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    const hot = tension > 0.4 ? `rgba(255,${230 - tension * 80},255,1)` : def.color;
    grad.addColorStop(0, withAlpha(def.color, 0.9));
    grad.addColorStop(1, hot);
    ctx.strokeStyle = grad;
    ctx.lineWidth = def.width;
    if (!lowQuality) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 6 + tension * 6;
    }
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
    tension: number,
    lowQuality: boolean,
  ): void {
    const flicker = 0.7 + Math.sin(time * 0.6) * 0.25;
    if (!lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha(def.color, 0.35 * flicker + tension * 0.25);
      ctx.lineWidth = def.width * 3.4;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = withAlpha(def.color, 0.9);
    ctx.lineWidth = def.width * 1.4;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    // Hot inner line
    ctx.strokeStyle = `rgba(255,255,255,${flicker})`;
    ctx.lineWidth = def.width * 0.55;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  private drawVine(
    ctx: CanvasRenderingContext2D,
    start: Vec2,
    end: Vec2,
    def: HookDef,
    time: number,
    tension: number,
    lowQuality: boolean,
  ): void {
    const segments = 14;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const nx = -dy;
    const ny = dx;
    const len = Math.hypot(nx, ny);
    const ux = len > 0 ? nx / len : 0;
    const uy = len > 0 ? ny / len : 0;
    const wave = 6 * (1 - tension * 0.6); // tension straightens the vine
    if (!lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha(def.color, 0.2);
      ctx.lineWidth = def.width + 4;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const w = Math.sin(t * Math.PI * 4 + time * 0.2) * wave * Math.sin(t * Math.PI);
        ctx.lineTo(start.x + dx * t + ux * w, start.y + dy * t + uy * w);
      }
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = def.color;
    ctx.lineWidth = def.width;
    if (!lowQuality) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const w = Math.sin(t * Math.PI * 4 + time * 0.2) * wave * Math.sin(t * Math.PI);
      ctx.lineTo(start.x + dx * t + ux * w, start.y + dy * t + uy * w);
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
    tension: number,
    lowQuality: boolean,
  ): void {
    const segments = 14;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const nx = -dy;
    const ny = dx;
    const len = Math.hypot(nx, ny);
    const ux = len > 0 ? nx / len : 0;
    const uy = len > 0 ? ny / len : 0;
    const jitterAmp = 3 + tension * 4;
    if (!lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha(def.color, 0.3);
      ctx.lineWidth = def.width + 4;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const j = (Math.sin(i * 17 + time) * 0.5 + (Math.random() - 0.5)) * jitterAmp;
        ctx.lineTo(start.x + dx * t + ux * j, start.y + dy * t + uy * j);
      }
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = def.color;
    ctx.lineWidth = def.width;
    if (!lowQuality) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const j = (Math.sin(i * 17 + time) * 0.5 + (Math.random() - 0.5)) * jitterAmp;
      ctx.lineTo(start.x + dx * t + ux * j, start.y + dy * t + uy * j);
    }
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

