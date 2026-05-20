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
        this.drawCable(ctx, start, end, def, tension, time, lowQuality);
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

    // Energy pulse — bright dot that travels along the rope from player to anchor.
    if (hook.state === 'attached' && !lowQuality) {
      this.drawEnergyPulse(ctx, start, end, def, time);
    }

    // Anchor visuals
    if (hook.state === 'attached') {
      const sinceAttach = time - this.lastAttachTime;
      const flashT = Math.max(0, 1 - sinceAttach / 18);
      // Impact ring + sub-rings just after attach
      if (flashT > 0 && !lowQuality) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Primary ring
        ctx.strokeStyle = withAlpha(def.color, flashT);
        ctx.lineWidth = 2.4 + (1 - flashT) * 2;
        ctx.beginPath();
        ctx.arc(end.x, end.y, 6 + (1 - flashT) * 26, 0, Math.PI * 2);
        ctx.stroke();
        // Echo ring (faster expansion, thinner)
        ctx.strokeStyle = withAlpha('#ffffff', flashT * 0.7);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(end.x, end.y, 10 + (1 - flashT) * 36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // Persistent anchor pulse
      const pulse = 0.6 + Math.sin(time * 0.2) * 0.4;
      if (!lowQuality) {
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 20 * pulse;
      }
      const r = 4 + pulse * 1.4;
      const grad = ctx.createRadialGradient(end.x, end.y, 0, end.x, end.y, r * 3.2);
      grad.addColorStop(0, withAlpha(def.color, 0.9));
      grad.addColorStop(0.5, withAlpha(def.color, 0.4));
      grad.addColorStop(1, withAlpha(def.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(end.x, end.y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      // Bright cross glint
      if (!lowQuality) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = withAlpha('#ffffff', 0.8 * pulse);
        ctx.lineWidth = 0.9;
        const crossLen = 8 + pulse * 4;
        ctx.beginPath();
        ctx.moveTo(end.x - crossLen, end.y);
        ctx.lineTo(end.x + crossLen, end.y);
        ctx.moveTo(end.x, end.y - crossLen);
        ctx.lineTo(end.x, end.y + crossLen);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(end.x, end.y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else if (hook.state === 'shooting') {
      // Bright trail head while shooting
      const grad = ctx.createRadialGradient(end.x, end.y, 0, end.x, end.y, 10);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, withAlpha(def.color, 0.9));
      grad.addColorStop(1, withAlpha(def.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(end.x, end.y, 10, 0, Math.PI * 2);
      ctx.fill();
      // Forward-facing cone glint while in-flight
      if (!lowQuality) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = withAlpha('#ffffff', 0.6);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    ctx.restore();
  }

  /**
   * Animated bright bead that slides along the rope from player to anchor —
   * conveys "energy flowing in" while attached. Tiny perf cost: one gradient
   * + one circle fill.
   */
  private drawEnergyPulse(
    ctx: CanvasRenderingContext2D,
    start: Vec2,
    end: Vec2,
    def: HookDef,
    time: number,
  ): void {
    // Two pulses traveling at slightly different speeds for richness.
    const speeds = [0.012, 0.018];
    for (const speed of speeds) {
      const t = ((time * speed) % 1 + 1) % 1;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const r = 5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
      grad.addColorStop(0, withAlpha('#ffffff', 0.9));
      grad.addColorStop(0.5, withAlpha(def.color, 0.6));
      grad.addColorStop(1, withAlpha(def.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawCable(
    ctx: CanvasRenderingContext2D,
    start: Vec2,
    end: Vec2,
    def: HookDef,
    tension: number,
    time: number,
    lowQuality: boolean,
  ): void {
    // Outer glow halo.
    if (!lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha(def.color, 0.3 + tension * 0.3);
      ctx.lineWidth = def.width + 5;
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

    // Bright shimmer band traveling along the cable — subtle.
    if (!lowQuality) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const t = (time * 0.02) % 1;
      const sx = start.x + dx * (t - 0.05);
      const sy = start.y + dy * (t - 0.05);
      const ex = start.x + dx * (t + 0.05);
      const ey = start.y + dy * (t + 0.05);
      const shimmer = ctx.createLinearGradient(sx, sy, ex, ey);
      shimmer.addColorStop(0, 'rgba(255,255,255,0)');
      shimmer.addColorStop(0.5, 'rgba(255,255,255,0.7)');
      shimmer.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = shimmer;
      ctx.lineWidth = Math.max(0.5, def.width * 0.6);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
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
      ctx.strokeStyle = withAlpha(def.color, 0.4 * flicker + tension * 0.3);
      ctx.lineWidth = def.width * 4;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = withAlpha(def.color, 0.95);
    ctx.lineWidth = def.width * 1.6;
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
    const segments = 16;
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
      ctx.strokeStyle = withAlpha(def.color, 0.25);
      ctx.lineWidth = def.width + 5;
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
      ctx.shadowBlur = 10;
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
    const segments = 16;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const nx = -dy;
    const ny = dx;
    const len = Math.hypot(nx, ny);
    const ux = len > 0 ? nx / len : 0;
    const uy = len > 0 ? ny / len : 0;
    const jitterAmp = 3 + tension * 5;
    if (!lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha(def.color, 0.35);
      ctx.lineWidth = def.width + 6;
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
      ctx.shadowBlur = 16;
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
