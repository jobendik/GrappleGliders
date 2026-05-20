import { Vec2 } from './Physics';
import { clamp } from '../utils/math';

export class Camera {
  position = new Vec2();
  target = new Vec2();
  zoom = 1;
  /** Current applied zoom — smoothed toward zoom target. */
  private zoomCurrent = 1;
  shakeAmount = 0;
  flashAmount = 0;
  chromaAmount = 0;
  /** Camera roll (rotation) in radians. Smoothed toward `rollTarget`. */
  roll = 0;
  rollTarget = 0;
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
    // Subtle camera roll responds to horizontal velocity — sells the swing.
    const horizSpeed = clamp(playerVel.x / 22, -1, 1);
    this.rollTarget = horizSpeed * 0.045; // ~2.6° max — gentle, not nauseating
  }

  update(dt: number): void {
    const t = 1 - Math.pow(1 - this.smoothing, dt);
    this.position.x += (this.target.x - this.position.x) * t;
    this.position.y += (this.target.y - this.position.y) * t;
    // Smooth roll + zoom toward their targets.
    this.roll += (this.rollTarget - this.roll) * t;
    this.zoomCurrent += (this.zoom - this.zoomCurrent) * t;
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

  /** Get smoothed zoom value (1 = neutral). */
  getZoom(): number {
    return this.zoomCurrent;
  }

  /** Punch the camera zoom for a brief moment (decays back to 1). */
  punchZoom(amount: number, durationFrames: number): void {
    this.zoom = Math.max(this.zoom, 1 + amount);
    // Auto-decay handled by zoom slowly returning to 1.
    setTimeout(() => { this.zoom = 1; }, (durationFrames / 60) * 1000);
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
    // Invert the rendering transform (translate(cw,ch) → scale → rotate →
    // translate(-cw,-ch) → translate(-x,-y)) so pointer hits land on the
    // intended world target even when the camera is zoomed/rolled.
    const cw = this.viewportWidth / 2;
    const ch = this.viewportHeight / 2;
    let dx = sx - cw;
    let dy = sy - ch;
    if (this.roll !== 0) {
      const cs = Math.cos(-this.roll);
      const sn = Math.sin(-this.roll);
      const rx = dx * cs - dy * sn;
      const ry = dx * sn + dy * cs;
      dx = rx;
      dy = ry;
    }
    if (this.zoomCurrent !== 1) {
      dx /= this.zoomCurrent;
      dy /= this.zoomCurrent;
    }
    return new Vec2(this.position.x + dx, this.position.y + dy);
  }

  reset(playerPos: Vec2): void {
    this.position.copy(playerPos);
    this.target.copy(playerPos);
    this.shakeAmount = 0;
    this.flashAmount = 0;
    this.chromaAmount = 0;
    this.roll = 0;
    this.rollTarget = 0;
    this.zoom = 1;
    this.zoomCurrent = 1;
    this.timeScale = 1;
    this.timeScaleTimer = 0;
  }
}
