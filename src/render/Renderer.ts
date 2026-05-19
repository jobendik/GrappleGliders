import type { Camera } from '../game/Camera';

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  cssWidth = 1;
  cssHeight = 1;
  maxDpr = 2;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    const w = Math.max(320, Math.floor(window.innerWidth));
    const h = Math.max(320, Math.floor(window.innerHeight));
    this.cssWidth = w;
    this.cssHeight = h;
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setMaxDpr(max: number): void {
    this.maxDpr = max;
    this.resize();
  }

  clear(color: string = '#000'): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  pushCamera(camera: Camera): void {
    const { x, y, shakeX, shakeY } = camera.getRenderOrigin();
    this.ctx.save();
    this.ctx.translate(-x + shakeX, -y + shakeY);
  }

  popCamera(): void {
    this.ctx.restore();
  }
}
