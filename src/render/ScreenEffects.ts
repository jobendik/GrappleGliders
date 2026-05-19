import type { Camera } from '../game/Camera';
import type { Renderer } from './Renderer';

interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class ScreenEffects {
  private floatingTexts: FloatingText[] = [];

  addFloatingText(
    text: string,
    x: number,
    y: number,
    color: string,
    options: { size?: number; vy?: number; life?: number } = {},
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
    });
  }

  update(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i]!;
      t.y += t.vy * dt;
      t.life -= 0.018 * dt;
      if (t.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  drawWorld(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 16px ui-monospace, monospace';
    for (const t of this.floatingTexts) {
      const a = Math.max(0, Math.min(1, t.life / t.maxLife));
      ctx.globalAlpha = a;
      ctx.font = `700 ${t.size}px ui-monospace, monospace`;
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 12;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawScreen(renderer: Renderer, camera: Camera): void {
    const ctx = renderer.ctx;
    if (camera.flashAmount > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${camera.flashAmount * 0.6})`;
      ctx.fillRect(0, 0, renderer.cssWidth, renderer.cssHeight);
      ctx.restore();
    }
    if (camera.chromaAmount > 0) {
      ctx.save();
      const a = camera.chromaAmount * 0.18;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(0,243,255,${a})`;
      ctx.fillRect(-3, 0, renderer.cssWidth, renderer.cssHeight);
      ctx.fillStyle = `rgba(255,43,255,${a})`;
      ctx.fillRect(3, 0, renderer.cssWidth, renderer.cssHeight);
      ctx.restore();
    }
  }

  clear(): void {
    this.floatingTexts.length = 0;
  }
}
