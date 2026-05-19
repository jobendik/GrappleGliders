import { Vec2 } from './Physics';
import { clamp } from '../utils/math';

export class Camera {
  position = new Vec2();
  target = new Vec2();
  zoom = 1;
  shakeAmount = 0;
  flashAmount = 0;
  chromaAmount = 0;
  timeScale = 1;
  timeScaleTimer = 0;
  viewportWidth = 1;
  viewportHeight = 1;
  smoothing = 0.085;
  lookAhead = 80;

  setViewport(w: number, h: number): void {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  follow(playerPos: Vec2, playerVel: Vec2): void {
    this.target.x = playerPos.x + playerVel.x * 2;
    this.target.y = playerPos.y - this.lookAhead + clamp(playerVel.y * 3, -200, 60);
  }

  update(dt: number): void {
    const t = 1 - Math.pow(1 - this.smoothing, dt);
    this.position.x += (this.target.x - this.position.x) * t;
    this.position.y += (this.target.y - this.position.y) * t;
    if (this.shakeAmount > 0) {
      this.shakeAmount = Math.max(0, this.shakeAmount - 0.5 * dt);
    }
    if (this.flashAmount > 0) {
      this.flashAmount = Math.max(0, this.flashAmount - 0.03 * dt);
    }
    if (this.chromaAmount > 0) {
      this.chromaAmount = Math.max(0, this.chromaAmount - 0.02 * dt);
    }
    if (this.timeScaleTimer > 0) {
      this.timeScaleTimer -= dt;
      if (this.timeScaleTimer <= 0) this.timeScale = 1;
    }
  }

  shake(amount: number): void {
    this.shakeAmount = Math.min(28, this.shakeAmount + amount);
  }

  flash(amount: number): void {
    this.flashAmount = Math.min(1, this.flashAmount + amount);
  }

  chroma(amount: number): void {
    this.chromaAmount = Math.min(1, this.chromaAmount + amount);
  }

  slowMo(scale: number, durationFrames: number): void {
    this.timeScale = scale;
    this.timeScaleTimer = durationFrames;
  }

  /** Compute the current world-space top-left for rendering. */
  getRenderOrigin(): { x: number; y: number; shakeX: number; shakeY: number } {
    const sx = (Math.random() - 0.5) * this.shakeAmount;
    const sy = (Math.random() - 0.5) * this.shakeAmount;
    return {
      x: this.position.x - this.viewportWidth / 2,
      y: this.position.y - this.viewportHeight / 2,
      shakeX: sx,
      shakeY: sy,
    };
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    return new Vec2(
      this.position.x - this.viewportWidth / 2 + sx,
      this.position.y - this.viewportHeight / 2 + sy,
    );
  }

  reset(playerPos: Vec2): void {
    this.position.copy(playerPos);
    this.target.copy(playerPos);
    this.shakeAmount = 0;
    this.flashAmount = 0;
    this.chromaAmount = 0;
    this.timeScale = 1;
    this.timeScaleTimer = 0;
  }
}
