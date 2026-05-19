import { Vec2 } from '../game/Physics';
import { rand } from '../utils/math';

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
}

const MAX_PARTICLES = 200;

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
});

export class ParticleSystem {
  private particles: ParticleData[] = [];
  private head = 0; // write index for round-robin overwrite when full

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) this.particles.push(createParticle());
  }

  burst(
    x: number,
    y: number,
    count: number,
    color: string,
    options: { speed?: number; gravity?: number; life?: number; size?: number } = {},
  ): void {
    const speedScale = options.speed ?? 1;
    const gravity = options.gravity ?? 0.02;
    const life = options.life ?? rand(0.6, 1.1);
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const angle = rand(0, Math.PI * 2);
      const speed = rand(1.5, 8) * speedScale;
      p.pos.set(x, y);
      p.vel.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
      p.color = color;
      p.size = options.size ?? rand(2, 4);
      p.life = life;
      p.maxLife = life;
      p.drag = 0.96;
      p.gravity = gravity;
      p.alive = true;
    }
  }

  spark(x: number, y: number, vx: number, vy: number, color: string, size: number = 2): void {
    const p = this.acquire();
    p.pos.set(x, y);
    p.vel.set(vx, vy);
    p.color = color;
    p.size = size;
    p.life = 0.6;
    p.maxLife = 0.6;
    p.drag = 0.94;
    p.gravity = 0;
    p.alive = true;
  }

  private acquire(): ParticleData {
    // Find a dead slot first; if none, overwrite oldest live slot.
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const idx = (this.head + i) % MAX_PARTICLES;
      const p = this.particles[idx]!;
      if (!p.alive) {
        this.head = (idx + 1) % MAX_PARTICLES;
        return p;
      }
    }
    const p = this.particles[this.head]!;
    this.head = (this.head + 1) % MAX_PARTICLES;
    return p;
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
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
    for (const p of this.particles) {
      if (!p.alive) continue;
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (!lowQuality) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10 * a;
      }
      ctx.fillRect(p.pos.x - p.size / 2, p.pos.y - p.size / 2, p.size, p.size);
    }
    ctx.shadowBlur = 0;
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
