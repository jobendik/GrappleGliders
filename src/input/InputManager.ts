import { Vec2 } from '../game/Physics';

export interface InputSnapshot {
  pointerDown: boolean;
  pointerJustDown: boolean;
  pointerJustReleased: boolean;
  pointer: { x: number; y: number };
  dashJustPressed: boolean;
  pauseJustPressed: boolean;
  reel: -1 | 0 | 1;
  moveX: number;
  isTouch: boolean;
  hasTwoFingers: boolean;
  twoFingerSwipeDown: boolean;
}

export type AudioUnlockCallback = () => void;

export class InputManager {
  pointer = new Vec2();
  pointerDown = false;
  pointerJustDown = false;
  pointerJustReleased = false;
  dashJustPressed = false;
  pauseJustPressed = false;
  isTouch = false;
  hasTwoFingers = false;
  twoFingerSwipeDown = false;
  /** When enabled, a tap toggles the hook state instead of being hold-to-grapple. */
  tapToggle = false;

  private keys = new Set<string>();
  private element: HTMLElement;
  private touches = new Map<number, { x: number; y: number; startX: number; startY: number; startTime: number }>();
  private secondTouchStartY = 0;
  private secondTouchActive = false;
  private audioUnlockCallback: AudioUnlockCallback | null = null;
  private audioUnlocked = false;
  // For tap-toggle mode
  private toggleActive = false;
  private lastTapTime = 0;

  constructor(element: HTMLElement) {
    this.element = element;
    this.attach();
  }

  onAudioUnlock(cb: AudioUnlockCallback): void {
    this.audioUnlockCallback = cb;
  }

  private fireUnlock(): void {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    this.audioUnlockCallback?.();
  }

  private attach(): void {
    const el = this.element;

    el.addEventListener(
      'mousemove',
      (e) => {
        this.pointer.set(e.clientX, e.clientY);
      },
      { passive: true },
    );
    el.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        e.preventDefault();
        this.dashJustPressed = true;
        return;
      }
      this.pointer.set(e.clientX, e.clientY);
      this.setPointerDown(true);
      // Defer audio initialisation to a microtask so the event handler returns
      // quickly (avoids the "[Violation] handler took Xms" warning).
      // Promise microtasks still run within the browser's user-activation window,
      // so iOS audio-unlock continues to work correctly.
      Promise.resolve().then(() => this.fireUnlock());
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) return;
      this.setPointerDown(false);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.isTouch = true;
        this.fireUnlock();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches.item(i);
          if (!t) continue;
          this.touches.set(t.identifier, {
            x: t.clientX,
            y: t.clientY,
            startX: t.clientX,
            startY: t.clientY,
            startTime: performance.now(),
          });
        }
        this.refreshPrimaryTouch();
        if (e.touches.length >= 2) {
          this.secondTouchActive = true;
          const second = e.touches.item(1);
          this.secondTouchStartY = second?.clientY ?? 0;
          this.hasTwoFingers = true;
        }
      },
      { passive: false },
    );
    el.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches.item(i);
          if (!t) continue;
          const stored = this.touches.get(t.identifier);
          if (stored) {
            stored.x = t.clientX;
            stored.y = t.clientY;
          }
        }
        this.refreshPrimaryTouch();
        if (this.secondTouchActive && e.touches.length >= 2) {
          const second = e.touches.item(1);
          if (second && second.clientY - this.secondTouchStartY > 80) {
            this.twoFingerSwipeDown = true;
            this.secondTouchStartY = second.clientY;
          }
        }
      },
      { passive: false },
    );
    const endTouch = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches.item(i);
        if (t) this.touches.delete(t.identifier);
      }
      if (e.touches.length < 2) {
        this.secondTouchActive = false;
        this.hasTwoFingers = false;
      }
      this.refreshPrimaryTouch();
    };
    el.addEventListener('touchend', endTouch, { passive: false });
    el.addEventListener('touchcancel', endTouch, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        this.dashJustPressed = true;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        this.pauseJustPressed = true;
      }
      this.fireUnlock();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.setPointerDown(false);
      this.touches.clear();
    });
  }

  private refreshPrimaryTouch(): void {
    const first = this.touches.values().next().value as
      | { x: number; y: number; startX: number; startY: number; startTime: number }
      | undefined;
    if (first) {
      this.pointer.set(first.x, first.y);
      this.setPointerDown(true);
      // Detect bottom-right dash button taps via touchcontrols overlay handled separately.
    } else {
      this.setPointerDown(false);
    }
  }

  private setPointerDown(down: boolean): void {
    if (this.tapToggle) {
      if (down && !this.toggleActive) {
        // First press starts grapple; releasing leaves it active until next tap.
        const now = performance.now();
        if (now - this.lastTapTime < 280) {
          this.toggleActive = false; // double-tap releases
          if (this.pointerDown) this.pointerJustReleased = true;
          this.pointerDown = false;
        } else {
          this.toggleActive = true;
          if (!this.pointerDown) this.pointerJustDown = true;
          this.pointerDown = true;
        }
        this.lastTapTime = now;
      } else if (!down) {
        // Releasing finger does nothing in toggle mode.
      }
      return;
    }
    if (down && !this.pointerDown) this.pointerJustDown = true;
    if (!down && this.pointerDown) this.pointerJustReleased = true;
    this.pointerDown = down;
  }

  setTapToggle(enabled: boolean): void {
    this.tapToggle = enabled;
    this.toggleActive = false;
  }

  /** Software-trigger dash from on-screen button. */
  triggerDash(): void {
    this.dashJustPressed = true;
  }

  /** Software-trigger pointer from on-screen grapple button. */
  setSoftPointer(down: boolean, x?: number, y?: number): void {
    if (typeof x === 'number' && typeof y === 'number') this.pointer.set(x, y);
    this.setPointerDown(down);
  }

  snapshot(): InputSnapshot {
    let move = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move += 1;
    let reel: -1 | 0 | 1 = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) reel = -1;
    else if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) reel = 1;

    const snap: InputSnapshot = {
      pointerDown: this.pointerDown,
      pointerJustDown: this.pointerJustDown,
      pointerJustReleased: this.pointerJustReleased,
      pointer: { x: this.pointer.x, y: this.pointer.y },
      dashJustPressed: this.dashJustPressed,
      pauseJustPressed: this.pauseJustPressed,
      reel,
      moveX: move,
      isTouch: this.isTouch,
      hasTwoFingers: this.hasTwoFingers,
      twoFingerSwipeDown: this.twoFingerSwipeDown,
    };
    return snap;
  }

  consume(): void {
    this.pointerJustDown = false;
    this.pointerJustReleased = false;
    this.dashJustPressed = false;
    this.pauseJustPressed = false;
    this.twoFingerSwipeDown = false;
  }
}
