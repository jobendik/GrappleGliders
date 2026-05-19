interface TutorialStep {
  message: string;
  durationMs: number;
}

const STEPS: TutorialStep[] = [
  { message: 'Tap and hold anywhere to fire your grapple.', durationMs: 5000 },
  { message: 'Release to fling — the harder the swing, the bigger the launch.', durationMs: 5000 },
  { message: 'Right-click, Space, or two-finger swipe down to dash.', durationMs: 5000 },
  { message: 'Avoid the rising lava. Climb as high as you can.', durationMs: 4500 },
];

export class Tutorial {
  private element: HTMLDivElement;
  private idx = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private complete = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tutorial-tip';
    this.element.style.display = 'none';
    document.body.appendChild(this.element);
  }

  start(onDone: () => void): void {
    this.complete = false;
    this.idx = 0;
    this.element.style.display = 'block';
    this.next(onDone);
  }

  private next(onDone: () => void): void {
    if (this.idx >= STEPS.length) {
      this.element.style.display = 'none';
      this.complete = true;
      onDone();
      return;
    }
    const step = STEPS[this.idx]!;
    this.element.textContent = step.message;
    this.timer = setTimeout(() => {
      this.idx += 1;
      this.next(onDone);
    }, step.durationMs);
  }

  skip(): void {
    if (this.timer) clearTimeout(this.timer);
    this.element.style.display = 'none';
    this.complete = true;
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.element.remove();
  }

  isComplete(): boolean {
    return this.complete;
  }
}
