import { TIME_ATTACK_COURSES, type TimeAttackCourse } from '../content/timeAttackCourses';
import type { SaveSystem } from '../systems/SaveSystem';

const MEDAL_EMOJI: Record<'gold' | 'silver' | 'bronze' | 'none', string> = {
  gold: 'GOLD',
  silver: 'SILVER',
  bronze: 'BRONZE',
  none: '—',
};

export class TimeAttackSelectScreen {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(save: SaveSystem, onPick: (course: TimeAttackCourse) => void, onClose: () => void): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
        onClose();
      }
    });
    const modal = document.createElement('div');
    modal.className = 'modal time-attack-select';
    const cards = TIME_ATTACK_COURSES.map((c) => this.renderCard(c, save)).join('');
    modal.innerHTML = `
      <div class="modal-content">
        <h1 class="title gradient-text">Time Attack</h1>
        <p class="subtitle">Four hand-crafted courses. Different shapes, different gold thresholds. Pick your fight.</p>
        <div class="course-grid" data-el="grid">${cards}</div>
        <div class="actions">
          <button class="ghost" data-el="close">Back</button>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;
    modal.querySelectorAll<HTMLElement>('[data-course]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.course!;
        const course = TIME_ATTACK_COURSES.find((c) => c.id === id);
        if (!course) return;
        this.close();
        onPick(course);
      });
    });
    modal.querySelector('[data-el="close"]')!.addEventListener('click', () => {
      this.close();
      onClose();
    });
  }

  private renderCard(course: TimeAttackCourse, save: SaveSystem): string {
    const key = `timeAttack:${course.id}`;
    const medal = save.data.timeAttackMedals[key] ?? 'none';
    const best = save.data.bestTime[key];
    const bestLabel = best !== undefined ? `${best.toFixed(2)} s` : '—';
    return `
      <button class="course-card medal-${medal}" data-course="${course.id}" style="--course-accent:${course.accent}">
        <div class="course-head">
          <h3>${course.name}</h3>
          <span class="medal-chip medal-${medal}">${MEDAL_EMOJI[medal]}</span>
        </div>
        <p class="course-blurb">${course.blurb}</p>
        <dl class="course-stats">
          <dt>Target</dt><dd>${course.targetAltitude.toLocaleString('en-US')} m</dd>
          <dt>Gold</dt><dd>${course.medals.gold.toFixed(0)} s</dd>
          <dt>Silver</dt><dd>${course.medals.silver.toFixed(0)} s</dd>
          <dt>Bronze</dt><dd>${course.medals.bronze.toFixed(0)} s</dd>
          <dt>Your best</dt><dd>${bestLabel}</dd>
        </dl>
      </button>
    `;
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
