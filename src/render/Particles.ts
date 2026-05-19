import { Vec2 } from '../game/Physics';
import { rand } from '../utils/math';
import { withAlpha } from '../utils/color';

type ParticleShape = 'square' | 'glow' | 'streak';

interface ParticleData {
  alive: boolean;
  pos: Vec2;
  vel: Vec2;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  drag: number;
  gravity: number;
  shape: ParticleShape;
  /** Previous-frame position for streak rendering. */
  prevX: number;
  prevY: number;
  /** Spin in radians for non-uniform glow. */
  spin: number;
}

const MAX_PARTICLES = 240;

const createParticle = (): ParticleData => ({
  alive: false,
  pos: new Vec2(),
  vel: new Vec2(),
  color: '#fff',
  size: 1,
  life: 0,
  maxLife: 1,
  drag: 0.96,
  gravity: 0.02,
  shape: 'square',
  prevX: 0,
  prevY: 0,
  spin: 0,
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
      p.size = options.size ?? rand(2.5, 5);
      p.life = life;
      p.maxLife = life;
      p.drag = 0.95;
      p.gravity = gravity;
      p.shape = shape;
      p.spin = rand(0, Math.PI * 2);
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
    p.size = size;
    p.life = 0.6;
    p.maxLife = 0.6;
    p.drag = 0.94;
    p.gravity = 0;
    p.shape = 'streak';
    p.spin = 0;
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
    p.size = rand(1.6, 3);
    p.life = rand(1.0, 1.6);
    p.maxLife = p.life;
    p.drag = 0.985;
    p.gravity = -0.012;
    p.shape = 'glow';
    p.spin = 0;
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
    p.size = rand(2.2, 3.4);
    p.life = 0.45;
    p.maxLife = 0.45;
    p.drag = 0.9;
    p.gravity = 0;
    p.shape = 'glow';
    p.spin = 0;
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

