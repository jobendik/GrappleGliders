import { Vec2 } from '../game/Physics';
import { rand } from '../utils/math';
import { withAlpha } from '../utils/color';

type ParticleShape = 'square' | 'glow' | 'streak' | 'ring' | 'star' | 'spark';

interface ParticleData {
  alive: boolean;
  pos: Vec2;
  vel: Vec2;
  color: string;
  /** Optional secondary color for color-bleed (e.g. white-hot core to color). */
  color2: string;
  size: number;
  life: number;
  maxLife: number;
  drag: number;
  gravity: number;
  shape: ParticleShape;
  /** Previous-frame position for streak rendering. */
  prevX: number;
  prevY: number;
  /** Spin in radians for non-uniform glow / rotation. */
  spin: number;
  spinSpeed: number;
  /** Expanding ring base radius. */
  baseSize: number;
}

const MAX_PARTICLES = 420;

const createParticle = (): ParticleData => ({
  alive: false,
  pos: new Vec2(),
  vel: new Vec2(),
  color: '#fff',
  color2: '#fff',
  size: 1,
  life: 0,
  maxLife: 1,
  drag: 0.96,
  gravity: 0.02,
  shape: 'square',
  prevX: 0,
  prevY: 0,
  spin: 0,
  spinSpeed: 0,
  baseSize: 1,
});

export class ParticleSystem {
  private particles: ParticleData[] = [];
  private head = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) this.particles.push(createParticle());
  }

  burst(
    x: number,
    y: number,
    count: number,
    color: string,
    options: {
      speed?: number;
      gravity?: number;
      life?: number;
      size?: number;
      shape?: ParticleShape;
    } = {},
  ): void {
    const speedScale = options.speed ?? 1;
    const gravity = options.gravity ?? 0.02;
    const life = options.life ?? rand(0.6, 1.1);
    const shape = options.shape ?? 'glow';
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const angle = rand(0, Math.PI * 2);
      const speed = rand(1.5, 8) * speedScale;
      p.pos.set(x, y);
      p.prevX = x;
      p.prevY = y;
      p.vel.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
      p.color = color;
      p.color2 = color;
      p.size = options.size ?? rand(2.5, 5);
      p.baseSize = p.size;
      p.life = life;
      p.maxLife = life;
      p.drag = 0.95;
      p.gravity = gravity;
      p.shape = shape;
      p.spin = rand(0, Math.PI * 2);
      p.spinSpeed = rand(-0.15, 0.15);
      p.alive = true;
    }
  }

  spark(x: number, y: number, vx: number, vy: number, color: string, size: number = 2): void {
    const p = this.acquire();
    p.pos.set(x, y);
    p.prevX = x;
    p.prevY = y;
    p.vel.set(vx, vy);
    p.color = color;
    p.color2 = color;
    p.size = size;
    p.baseSize = size;
    p.life = 0.6;
    p.maxLife = 0.6;
    p.drag = 0.94;
    p.gravity = 0;
    p.shape = 'streak';
    p.spin = 0;
    p.spinSpeed = 0;
    p.alive = true;
  }

  /** Emit a single rising ember (used by lava). */
  ember(x: number, y: number, color: string): void {
    const p = this.acquire();
    p.pos.set(x, y);
    p.prevX = x;
    p.prevY = y;
    p.vel.set(rand(-0.8, 0.8), rand(-3.4, -1.6));
    p.color = color;
    p.color2 = '#ffffff';
    p.size = rand(1.6, 3);
    p.baseSize = p.size;
    p.life = rand(1.0, 1.6);
    p.maxLife = p.life;
    p.drag = 0.985;
    p.gravity = -0.012;
    p.shape = 'glow';
    p.spin = 0;
    p.spinSpeed = 0;
    p.alive = true;
  }

  /** Thrust puff for player movement / dash. */
  thruster(x: number, y: number, vx: number, vy: number, color: string): void {
    const p = this.acquire();
    p.pos.set(x, y);
    p.prevX = x;
    p.prevY = y;
    p.vel.set(vx, vy);
    p.color = color;
    p.color2 = '#ffffff';
    p.size = rand(2.2, 3.4);
    p.baseSize = p.size;
    p.life = 0.45;
    p.maxLife = 0.45;
    p.drag = 0.9;
    p.gravity = 0;
    p.shape = 'glow';
    p.spin = 0;
    p.spinSpeed = 0;
    p.alive = true;
  }

  /**
   * Expanding shockwave ring — single particle that grows and fades. Best
   * placed at impact moments (hook anchor, dash burst, milestone).
   */
  shockwave(x: number, y: number, color: string, options: { size?: number; life?: number; thickness?: number } = {}): void {
    const p = this.acquire();
    p.pos.set(x, y);
    p.prevX = x;
    p.prevY = y;
    p.vel.set(0, 0);
    p.color = color;
    p.color2 = '#ffffff';
    p.size = options.thickness ?? 3;
    p.baseSize = options.size ?? 24;
    p.life = options.life ?? 0.55;
    p.maxLife = p.life;
    p.drag = 1;
    p.gravity = 0;
    p.shape = 'ring';
    p.spin = 0;
    p.spinSpeed = 0;
    p.alive = true;
  }

  /** Rotating cross/star sparkle — used for sparks, milestones, perfect anchors. */
  sparkle(x: number, y: number, color: string, options: { size?: number; life?: number; vx?: number; vy?: number } = {}): void {
    const p = this.acquire();
    p.pos.set(x, y);
    p.prevX = x;
    p.prevY = y;
    p.vel.set(options.vx ?? 0, options.vy ?? 0);
    p.color = color;
    p.color2 = '#ffffff';
    p.size = options.size ?? rand(4, 8);
    p.baseSize = p.size;
    p.life = options.life ?? rand(0.6, 1.2);
    p.maxLife = p.life;
    p.drag = 0.96;
    p.gravity = 0;
    p.shape = 'star';
    p.spin = rand(0, Math.PI * 2);
    p.spinSpeed = rand(-0.08, 0.08);
    p.alive = true;
  }

  /**
   * Hot sub-spark — short-lived comet with a tail. Use for crackle bits flying
   * off impacts and crackling around energy nodes.
   */
  hotSpark(x: number, y: number, vx: number, vy: number, color: string, life: number = 0.35): void {
    const p = this.acquire();
    p.pos.set(x, y);
    p.prevX = x;
    p.prevY = y;
    p.vel.set(vx, vy);
    p.color = color;
    p.color2 = '#ffffff';
    p.size = rand(1.2, 2);
    p.baseSize = p.size;
    p.life = life;
    p.maxLife = life;
    p.drag = 0.92;
    p.gravity = 0.04;
    p.shape = 'spark';
    p.spin = 0;
    p.spinSpeed = 0;
    p.alive = true;
  }

  /** Bigger, slower drifting dust mote (used for atmosphere). */
  mote(x: number, y: number, color: string): void {
    const p = this.acquire();
    p.pos.set(x, y);
    p.prevX = x;
    p.prevY = y;
    p.vel.set(rand(-0.3, 0.3), rand(-0.4, -0.1));
    p.color = color;
    p.color2 = color;
    p.size = rand(0.8, 1.8);
    p.baseSize = p.size;
    p.life = rand(1.6, 3.2);
    p.maxLife = p.life;
    p.drag = 0.995;
    p.gravity = -0.001;
    p.shape = 'glow';
    p.spin = 0;
    p.spinSpeed = 0;
    p.alive = true;
  }

  private acquire(): ParticleData {
    for (let i = 0; i < this.particles.length; i++) {
      const idx = (this.head + i) % this.particles.length;
      const p = this.particles[idx]!;
      if (!p.alive) {
        this.head = (idx + 1) % this.particles.length;
        return p;
      }
    }
    const p = this.particles[this.head]!;
    this.head = (this.head + 1) % this.particles.length;
    return p;
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.prevX = p.pos.x;
      p.prevY = p.pos.y;
      p.vel.y += p.gravity * dt;
      p.vel.scale(Math.pow(p.drag, dt));
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.spin += p.spinSpeed * dt;
      p.life -= 0.018 * dt;
      if (p.life <= 0) p.alive = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D, lowQuality: boolean): void {
    ctx.save();
    // Additive blending makes glows pop on dark sky without breaking on
    // brighter platforms.
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      if (!p.alive) continue;
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      if (p.shape === 'streak') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.8, p.size * 0.7);
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.pos.x, p.pos.y);
        ctx.stroke();
        continue;
      }
      if (p.shape === 'spark') {
        // Streak + hot dot.
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.6, p.size * 0.9);
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.pos.x, p.pos.y);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, Math.max(0.7, p.size * 0.6), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (p.shape === 'ring') {
        // Expanding glow ring with thinning stroke.
        const t = 1 - a;
        const r = p.baseSize + t * p.baseSize * 3;
        const stroke = Math.max(0.2, p.size * a);
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = stroke;
        if (!lowQuality) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 18 * a;
        }
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Inner bright pulse early on
        if (a > 0.7 && !lowQuality) {
          ctx.globalAlpha = (a - 0.7) * 2.4;
          ctx.fillStyle = withAlpha('#ffffff', 0.6);
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      if (p.shape === 'star') {
        // 4-pointed cross + soft halo.
        if (!lowQuality) {
          const r = p.size * (1 + (1 - a) * 0.6);
          const grad = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, r * 3);
          grad.addColorStop(0, withAlpha(p.color, a * 0.8));
          grad.addColorStop(0.4, withAlpha(p.color, a * 0.3));
          grad.addColorStop(1, withAlpha(p.color, 0));
          ctx.fillStyle = grad;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        // Cross beams
        const beam = p.size * (1.4 + Math.sin(p.spin * 4) * 0.3);
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.1;
        const cs = Math.cos(p.spin);
        const sn = Math.sin(p.spin);
        ctx.beginPath();
        ctx.moveTo(p.pos.x - cs * beam, p.pos.y - sn * beam);
        ctx.lineTo(p.pos.x + cs * beam, p.pos.y + sn * beam);
        ctx.moveTo(p.pos.x + sn * beam, p.pos.y - cs * beam);
        ctx.lineTo(p.pos.x - sn * beam, p.pos.y + cs * beam);
        ctx.stroke();
        ctx.strokeStyle = withAlpha(p.color, a * 0.9);
        ctx.lineWidth = 0.5;
        ctx.stroke();
        continue;
      }
      if (p.shape === 'glow' && !lowQuality) {
        const r = p.size * (1 + (1 - a) * 1.6);
        const grad = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, r * 2.4);
        grad.addColorStop(0, withAlpha(p.color, a));
        grad.addColorStop(0.4, withAlpha(p.color, a * 0.5));
        grad.addColorStop(1, withAlpha(p.color, 0));
        ctx.fillStyle = grad;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
        // Hot core
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, Math.max(0.6, r * 0.6), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      // square fallback
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.pos.x - p.size / 2, p.pos.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  clear(): void {
    for (const p of this.particles) p.alive = false;
  }

  setLimit(limit: number): void {
    while (this.particles.length > limit) this.particles.pop();
    while (this.particles.length < limit) this.particles.push(createParticle());
  }
}
