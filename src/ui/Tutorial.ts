/**
 * Interactive onboarding. Each step waits for the player to perform the
 * required action (fire a grapple, release it, dash) before advancing, with a
 * timed fallback so anyone stuck on a step still progresses. The UI highlights
 * the relevant button on mobile and shows a clear hint card.
 */

export type TutorialAction = 'hookConnect' | 'hookRelease' | 'dash' | 'altitude';

interface TutorialStep {
  /** Hint message shown to the player. */
  message: string;
  /** Action required to advance. `null` means timed only. */
  require: TutorialAction | null;
  /** ms before the step auto-advances even if the action wasn't completed. */
  fallbackMs: number;
  /** Optional CSS selector for an element to highlight while the step is active. */
  highlight?: string;
  /** Optional altitude threshold for the 'altitude' action. */
  threshold?: number;
}

/**
 * Tutorial copy is gesture-aware: on touch devices it teaches the drag-aim,
 * release-to-fire model; on desktop it teaches the classic click-and-hold.
 * Both share the same `require` keys so the underlying flow is identical.
 */
const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' &&
  (matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    (navigator?.maxTouchPoints ?? 0) > 0);

const TOUCH_STEPS: TutorialStep[] = [
  {
    message: 'Drag from anywhere — a reticle snaps to glowing platforms. Lift your finger to fire your grapple.',
    require: 'hookConnect',
    fallbackMs: 15000,
  },
  {
    message: 'Once attached, use the ▲ button to climb the rope, or ▼ to swing wider. Tap anywhere to release.',
    require: 'hookRelease',
    fallbackMs: 14000,
  },
  {
    message: 'Tap the DASH button to burst forward. Your aim direction matters — finger held = dash that way.',
    require: 'dash',
    fallbackMs: 12000,
    highlight: '.touch-btn.dash',
  },
  {
    message: 'Lava is rising — climb fast. Reach 100m to finish the tutorial.',
    require: 'altitude',
    threshold: 100,
    fallbackMs: 30000,
  },
];

const DESKTOP_STEPS: TutorialStep[] = [
  {
    message: 'Aim at a glowing platform — click & HOLD to fire your grapple.',
    require: 'hookConnect',
    fallbackMs: 15000,
  },
  {
    message: 'Now RELEASE to fling forward. Bigger swings launch you higher.',
    require: 'hookRelease',
    fallbackMs: 12000,
  },
  {
    message: 'Press SPACE to dash — burst through gaps. (W/S reels the rope in or out while attached.)',
    require: 'dash',
    fallbackMs: 12000,
  },
  {
    message: 'Lava is rising — climb fast. Reach 100m to finish the tutorial.',
    require: 'altitude',
    threshold: 100,
    fallbackMs: 30000,
  },
];

const STEPS: TutorialStep[] = isTouchDevice() ? TOUCH_STEPS : DESKTOP_STEPS;

export class Tutorial {
  private card: HTMLDivElement;
  private progress: HTMLDivElement;
  private idx = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private highlightedEl: HTMLElement | null = null;
  private complete = false;
  private currentStep: TutorialStep | null = null;
  private onDone: (() => void) | null = null;
  private skipBtn: HTMLButtonElement;

  constructor() {
    this.card = document.createElement('div');
    this.card.className = 'tutorial-card';
    this.card.style.display = 'none';
    this.card.innerHTML = `
      <div class="tutorial-step-label" data-el="label">Step 1 of ${STEPS.length}</div>
      <div class="tutorial-message" data-el="message"></div>
      <div class="tutorial-progress" data-el="progress">
        ${STEPS.map(() => '<span></span>').join('')}
      </div>
      <button class="tutorial-skip" data-el="skip">Skip Tutorial</button>
    `;
    document.body.appendChild(this.card);
    this.progress = this.card.querySelector<HTMLDivElement>('[data-el="progress"]')!;
    this.skipBtn = this.card.querySelector<HTMLButtonElement>('[data-el="skip"]')!;
    const skipHandler = (e: Event): void => {
      e.stopPropagation();
      e.preventDefault();
      this.finish();
    };
    this.skipBtn.addEventListener('pointerdown', skipHandler);
    this.skipBtn.addEventListener('click', skipHandler);
  }

  start(onDone: () => void): void {
    this.onDone = onDone;
    this.complete = false;
    this.idx = 0;
    this.card.style.display = 'flex';
    this.next();
  }

  private next(): void {
    this.clearHighlight();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.idx >= STEPS.length) {
      this.finish();
      return;
    }
    const step = STEPS[this.idx]!;
    this.currentStep = step;
    const labelEl = this.card.querySelector<HTMLElement>('[data-el="label"]')!;
    const messageEl = this.card.querySelector<HTMLElement>('[data-el="message"]')!;
    labelEl.textContent = `Step ${this.idx + 1} of ${STEPS.length}`;
    messageEl.textContent = step.message;
    this.updateProgress();
    if (step.highlight) {
      // Defer one frame so we pick up freshly-created touch controls.
      requestAnimationFrame(() => this.applyHighlight(step.highlight!));
    }
    this.timer = setTimeout(() => this.advance(), step.fallbackMs);
  }

  private applyHighlight(selector: string): void {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.classList.add('tutorial-highlight');
    this.highlightedEl = el;
  }

  private clearHighlight(): void {
    if (this.highlightedEl) {
      this.highlightedEl.classList.remove('tutorial-highlight');
      this.highlightedEl = null;
    }
  }

  private updateProgress(): void {
    const dots = this.progress.querySelectorAll('span');
    dots.forEach((d, i) => {
      d.classList.toggle('done', i < this.idx);
      d.classList.toggle('active', i === this.idx);
    });
  }

  /** Called by the game when the player performs the given action. */
  notify(action: TutorialAction, payload?: { altitude?: number }): void {
    if (this.complete || !this.currentStep) return;
    if (this.currentStep.require !== action) return;
    if (action === 'altitude') {
      const threshold = this.currentStep.threshold ?? 0;
      if ((payload?.altitude ?? 0) < threshold) return;
    }
    this.advance();
  }

  private advance(): void {
    if (this.complete) return;
    this.idx += 1;
    this.next();
  }

  private finish(): void {
    if (this.complete) return;
    this.complete = true;
    this.clearHighlight();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.card.style.display = 'none';
    this.onDone?.();
  }

  skip(): void {
    this.finish();
  }

  destroy(): void {
    this.clearHighlight();
    if (this.timer) clearTimeout(this.timer);
    this.card.remove();
  }

  isComplete(): boolean {
    return this.complete;
  }
}
