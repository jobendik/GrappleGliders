import type { Camera } from '../game/Camera';
import type { Renderer } from './Renderer';
import { withAlpha } from '../utils/color';

interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  /** When true, render with a chunky outline + pulse — for milestone/combo callouts. */
  bold: boolean;
}

interface SpeedLine {
  /** Screen-space x. */
  x: number;
  /** Screen-space y. */
  y: number;
  /** Horizontal length in px. */
  len: number;
  /** Vertical drift per frame. */
  vy: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export class ScreenEffects {
  private floatingTexts: FloatingText[] = [];
  private speedLines: SpeedLine[] = [];

  /**
   * Combo border tint — color and intensity, controlled by Game. When > 0 a
   * colored vignette pulse is drawn around the screen edges.
   */
  comboTint: { color: string; intensity: number } = { color: '#ff9d2e', intensity: 0 };

  /**
   * Speed-induced post effects — controlled by Game. 0..1 ramping with player
   * velocity. Drives speed lines, slight chromatic bleed, and a scanline pulse.
   */
  speedIntensity = 0;

  /** Pulses on big events: hook attach, dash, milestone. 0..1. */
  bloomPulse = 0;

  addFloatingText(
    text: string,
    x: number,
    y: number,
    color: string,
    options: { size?: number; vy?: number; life?: number; bold?: boolean } = {},
  ): void {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: options.vy ?? -1.2,
      life: options.life ?? 1.2,
      maxLife: options.life ?? 1.2,
      color,
      size: options.size ?? 16,
      bold: options.bold ?? false,
    });
  }

  /** Convenience: set the combo border tint with auto-decay. */
  setComboTint(color: string, intensity: number): void {
    this.comboTint.color = color;
    this.comboTint.intensity = Math.max(this.comboTint.intensity, intensity);
  }

  pulseBloom(amount: number): void {
    this.bloomPulse = Math.min(1, this.bloomPulse + amount);
  }

  /** Spawn a few speed lines based on intensity. Called by Game when fast. */
  emitSpeedLines(intensity: number, w: number, h: number): void {
    if (intensity <= 0.1) return;
    const target = Math.floor(intensity * 4);
    while (this.speedLines.length < target) {
      const fromLeft = Math.random() < 0.5;
      const len = 50 + Math.random() * 120 * intensity;
      this.speedLines.push({
        x: fromLeft ? -len : w,
        y: 20 + Math.random() * (h - 40),
        len,
        vy: (Math.random() - 0.5) * 0.2,
        life: 0.4,
        maxLife: 0.4,
        alpha: 0.18 + Math.random() * 0.25,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i]!;
      t.y += t.vy * dt;
      t.life -= 0.018 * dt;
      if (t.life <= 0) this.floatingTexts.splice(i, 1);
    }
    // Speed lines tear across the screen and fade.
    for (let i = this.speedLines.length - 1; i >= 0; i--) {
      const s = this.speedLines[i]!;
      s.x += 30 * dt; // sweep right
      s.y += s.vy * dt;
      s.life -= 0.06 * dt;
      if (s.life <= 0) this.speedLines.splice(i, 1);
    }
    // Decay combo tint and bloom pulse over time.
    if (this.comboTint.intensity > 0) {
      this.comboTint.intensity = Math.max(0, this.comboTint.intensity - 0.012 * dt);
    }
    if (this.bloomPulse > 0) {
      this.bloomPulse = Math.max(0, this.bloomPulse - 0.04 * dt);
    }
  }

  drawWorld(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.floatingTexts) {
      const a = Math.max(0, Math.min(1, t.life / t.maxLife));
      const scale = t.bold ? 1 + (1 - a) * 0.4 : 1;
      ctx.globalAlpha = a;
      ctx.font = `900 ${t.size * scale}px Orbitron, ui-monospace, monospace`;
      // Outer shadow halo
      ctx.shadowColor = t.color;
      ctx.shadowBlur = t.bold ? 24 : 14;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      if (t.bold) {
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = a * 0.85;
        ctx.strokeText(t.text, t.x, t.y);
      }
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawScreen(renderer: Renderer, camera: Camera): void {
    const ctx = renderer.ctx;
    const w = renderer.cssWidth;
    const h = renderer.cssHeight;

    // Speed lines: subtle horizontal streaks that ride over the world.
    if (this.speedLines.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const s of this.speedLines) {
        const a = Math.max(0, s.life / s.maxLife) * s.alpha;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.len, s.y);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, `rgba(255,255,255,${a})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(s.x, s.y, s.len, 1.2);
      }
      ctx.restore();
    }

    // Combo border tint — colored vignette glowing inward, scales with intensity.
    if (this.comboTint.intensity > 0) {
      ctx.save();
      const t = Math.min(1, this.comboTint.intensity);
      const pulse = 0.6 + Math.sin(performance.now() * 0.006) * 0.4;
      const grad = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.35,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.7,
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, withAlpha(this.comboTint.color, t * 0.55 * pulse));
      ctx.fillStyle = grad;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Camera flash (white) — instantaneous burst, additive.
    if (camera.flashAmount > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,255,255,${camera.flashAmount * 0.6})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Bloom pulse — soft white center wash for triumphant moments.
    if (this.bloomPulse > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(
        w / 2,
        h * 0.55,
        0,
        w / 2,
        h * 0.55,
        Math.max(w, h) * 0.6,
      );
      grad.addColorStop(0, `rgba(255,255,255,${this.bloomPulse * 0.35})`);
      grad.addColorStop(0.4, `rgba(255,255,255,${this.bloomPulse * 0.1})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Chromatic aberration: split a faint cyan/magenta band horizontally for
    // arcade impact. Scaled by both event chroma AND speed intensity.
    const chroma = Math.max(camera.chromaAmount, this.speedIntensity * 0.5);
    if (chroma > 0) {
      ctx.save();
      const a = chroma * 0.22;
      const offset = 2 + chroma * 3;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(0,243,255,${a})`;
      ctx.fillRect(-offset, 0, w, h);
      ctx.fillStyle = `rgba(255,43,255,${a})`;
      ctx.fillRect(offset, 0, w, h);
      ctx.restore();
    }

    // Speed lensing — radial blur effect approximated with a darkened halo
    // squeezing from the edges. Subtle but does the trick at high velocity.
    if (this.speedIntensity > 0.25) {
      ctx.save();
      const t = Math.min(1, (this.speedIntensity - 0.25) * 1.4);
      const grad = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.25,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.7,
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${t * 0.4})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // (CRT scanlines are handled by CSS body::after — not duplicated here.)

    // Edge vignette — final pass that always darkens corners a bit.
    ctx.save();
    const grad = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.35,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.85,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  clear(): void {
    this.floatingTexts.length = 0;
    this.speedLines.length = 0;
    this.comboTint.intensity = 0;
    this.speedIntensity = 0;
    this.bloomPulse = 0;
  }
}
