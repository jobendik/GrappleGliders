import type { GrapplingHook } from '../game/GrapplingHook';
import type { HookDef } from '../content/hooks';
import { PHYSICS, Vec2 } from '../game/Physics';
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
    slingMode: boolean = false,
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

    // Pendulum-swing mode: draw two parallel strands forming a V from the
    // peg down to two offset attach points near the player. Matches the
    // Talking Tom Go Up look.
    const useV = slingMode && hook.state === 'attached';

    if (useV) {
      this.drawSlingRopes(ctx, start, end, def, tension, time, lowQuality);
    } else {
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

  /**
   * Sling-mode aim overlay: rubber band stretched from the peg toward the
   * pulled-back hang point, plus a fading dotted trajectory preview that
   * shows the launch arc the player will follow on release.
   *
   * @param pegPos  Anchor pin world position
   * @param hangPos Where the character hangs (peg + sling hang offset)
   * @param drag    Pull vector in world px (drag direction; launch is opposite)
   * @param color   Theme accent for the band/preview
   * @param time    Frame counter for animation
   */
  drawSlingAim(
    ctx: CanvasRenderingContext2D,
    pegPos: Vec2,
    hangPos: Vec2,
    drag: Vec2,
    color: string,
    time: number,
  ): void {
    const dragLen = Math.hypot(drag.x, drag.y);
    if (dragLen < PHYSICS.slingDeadZonePx) return;

    const power = Math.min(1, dragLen / PHYSICS.slingMaxDragPx);
    const impulse =
      PHYSICS.slingMinImpulse +
      (PHYSICS.slingMaxImpulse - PHYSICS.slingMinImpulse) * power;
    const dirX = -drag.x / dragLen;
    const dirY = -drag.y / dragLen;

    // Visually displaced hang position — the character looks like it's been
    // pulled back along the drag direction. Capped so the rubber band can't
    // stretch infinitely on the screen at full power.
    const pullCap = Math.min(dragLen, PHYSICS.slingMaxDragPx) * 0.35;
    const pulledX = hangPos.x + (drag.x / dragLen) * pullCap;
    const pulledY = hangPos.y + (drag.y / dragLen) * pullCap;

    ctx.save();

    // Rubber band — two strands from either side of the peg meeting at the
    // pulled-back point. Width and brightness scale with power.
    const bandColor = withAlpha(color, 0.55 + power * 0.35);
    ctx.strokeStyle = bandColor;
    ctx.lineWidth = 2 + power * 2.5;
    ctx.lineCap = 'round';
    const perpX = -dirY * 6;
    const perpY = dirX * 6;
    ctx.beginPath();
    ctx.moveTo(pegPos.x + perpX, pegPos.y + perpY);
    ctx.lineTo(pulledX, pulledY);
    ctx.lineTo(pegPos.x - perpX, pegPos.y - perpY);
    ctx.stroke();

    // Trajectory preview — simulate the launch arc using the same physics
    // as Player.updateSling. Plot fading dots at fixed intervals.
    const steps = 22;
    const dt = 2.2; // larger step = sparser dots
    let vx = dirX * impulse;
    let vy = dirY * impulse;
    let px = hangPos.x;
    let py = hangPos.y;
    ctx.fillStyle = withAlpha('#ffffff', 0.9);
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    for (let i = 0; i < steps; i++) {
      vy += PHYSICS.gravity * dt;
      vx *= Math.pow(PHYSICS.airDrag, dt);
      vy *= Math.pow(PHYSICS.airDrag, dt);
      px += vx * dt;
      py += vy * dt;
      const alpha = 1 - i / steps;
      const r = 3.6 * alpha + 1.4;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Power readout: faint pulse ring around the peg whose brightness
    // tracks the current power level.
    const pulse = 0.6 + Math.sin(time * 0.25) * 0.4;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = withAlpha(color, 0.4 * power * pulse);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pegPos.x, pegPos.y, 18 + power * 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();
  }

  /**
   * Draws a faint dashed circle showing the player's current orbital path
   * while attached. Called by Game.ts for the human player only.
   */
  drawOrbitArc(
    ctx: CanvasRenderingContext2D,
    hook: GrapplingHook,
    time: number,
  ): void {
    if (hook.state !== 'attached') return;
    const cx = hook.position.x;
    const cy = hook.position.y;
    const r = hook.ropeLength;
    const pulse = 0.45 + Math.sin(time * 0.14) * 0.3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,255,255,${0.12 * pulse})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 14]);
    ctx.lineDashOffset = -time * 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Pendulum-swing rope rendering. Draws two parallel strands from the peg
   * (end) down to two perpendicular-offset anchor points near the player
   * (start). Forms the V/triangle silhouette of Talking Tom Go Up.
   *
   * Visually treats the two ropes as plain cables regardless of `def.rope`,
   * since exotic hook styles (laser, lightning) read poorly as twin strands.
   */
  private drawSlingRopes(
    ctx: CanvasRenderingContext2D,
    start: Vec2,
    end: Vec2,
    def: HookDef,
    tension: number,
    time: number,
    lowQuality: boolean,
  ): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy) || 1e-3;
    // Unit vector from player toward peg.
    const ux = dx / dist;
    const uy = dy / dist;
    // Perpendicular (rotated 90°). Defines the "shoulder" offset.
    const perpX = -uy;
    const perpY = ux;
    // Wider at the player end, meeting at a single point at the peg.
    const shoulderOffset = 7;
    const leftSx = start.x + perpX * shoulderOffset;
    const leftSy = start.y + perpY * shoulderOffset;
    const rightSx = start.x - perpX * shoulderOffset;
    const rightSy = start.y - perpY * shoulderOffset;

    const lineWidth = Math.max(1.6, def.width * 0.7);

    // Outer glow halo (cheap additive pass to make the ropes pop).
    if (!lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha(def.color, 0.25 + tension * 0.25);
      ctx.lineWidth = lineWidth + 3;
      ctx.beginPath();
      ctx.moveTo(leftSx, leftSy);
      ctx.lineTo(end.x, end.y);
      ctx.moveTo(rightSx, rightSy);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }

    // Core strands.
    const coreColor = tension > 0.4
      ? `rgba(255,${230 - tension * 80},255,1)`
      : def.color;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = lineWidth;
    if (!lowQuality) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 5 + tension * 5;
    }
    ctx.beginPath();
    ctx.moveTo(leftSx, leftSy);
    ctx.lineTo(end.x, end.y);
    ctx.moveTo(rightSx, rightSy);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Tiny shimmer dots traveling along each strand (skip in low-quality).
    if (!lowQuality) {
      const t = (time * 0.02) % 1;
      const lx = leftSx + (end.x - leftSx) * t;
      const ly = leftSy + (end.y - leftSy) * t;
      const rx = rightSx + (end.x - rightSx) * t;
      const ry = rightSy + (end.y - rightSy) * t;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = withAlpha('#ffffff', 0.85);
      ctx.beginPath();
      ctx.arc(lx, ly, 1.6, 0, Math.PI * 2);
      ctx.arc(rx, ry, 1.6, 0, Math.PI * 2);
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
