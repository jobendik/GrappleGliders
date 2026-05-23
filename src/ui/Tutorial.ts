/**
 * Interactive onboarding. Each step waits for the player to perform the
 * required action (fire a grapple, swing left/right, release, climb) before
 * advancing. Steps that gate progress have NO fallback timer — they wait
 * forever, because a CrazyGames-platform first-time player needs to learn
 * by doing, not by watching the hint disappear before they understand it.
 *
 * The game freezes lava entirely while the tutorial is active (see
 * `Game.inTutorialFlow`), so a player cannot fail out of the tutorial.
 */

export type TutorialAction =
  | 'hookConnect'
  | 'hookRelease'
  | 'swing'
  | 'dash'
  | 'altitude';

interface TutorialStep {
  /** Hint message shown to the player. */
  message: string;
  /** Action required to advance. `null` means timed only. */
  require: TutorialAction | null;
  /**
   * ms before the step auto-advances even if the action wasn't completed.
   * `null` means the step waits indefinitely. Use `null` for any step
   * that gates real progress so the prompt never disappears while the
   * player is still figuring out what to do.
   */
  fallbackMs: number | null;
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
    message:
      'Fly close to a glowing platform — you\'ll automatically latch on and start spinning! No lava yet, take your time.',
    require: 'hookConnect',
    fallbackMs: null,
  },
  {
    message:
      'TAP anywhere to release at the right moment and fly upward! Time your tap when you\'re heading UP.',
    require: 'hookRelease',
    fallbackMs: null,
  },
  {
    message:
      'GOAL: Climb as high as you can! Latch on → spin → tap to release, repeat. Reach 120m to graduate.',
    require: 'altitude',
    threshold: 120,
    fallbackMs: null,
  },
];

const DESKTOP_STEPS: TutorialStep[] = [
  {
    message:
      'Fly close to a glowing platform — you\'ll automatically latch on and start spinning! No lava yet, take your time.',
    require: 'hookConnect',
    fallbackMs: null,
  },
  {
    message:
      'CLICK (or press Space) to release at the right moment and fling upward! Release when you\'re heading UP.',
    require: 'hookRelease',
    fallbackMs: null,
  },
  {
    message:
      'GOAL: Climb as high as you can! Latch on → spin → release, repeat. Reach 120m to graduate.',
    require: 'altitude',
    threshold: 120,
    fallbackMs: null,
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
    if (step.fallbackMs !== null) {
      this.timer = setTimeout(() => this.advance(), step.fallbackMs);
    }
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
