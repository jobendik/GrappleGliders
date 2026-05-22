/**
 * Pre-roll "GET READY" overlay shown at the start of every run.
 *
 * Two dismissal modes:
 *   - Timed (returning players): badge auto-fades after `durationMs`.
 *   - Wait-for-input (first-run players): badge stays visible until the
 *     player clicks/taps anywhere. Critical for CrazyGames — a brand-new
 *     player needs as long as they need to read the screen before any
 *     timer steals the hint away.
 *
 * The overlay never blocks input. Game.ts honors the grace window in
 * physics; the overlay just provides the on-screen badge + hint.
 */
export interface ReadyOverlayOptions {
  /** One-line hint placed under the badge (control prompt). */
  inputHint: string;
  /**
   * How long the overlay stays visible, in ms. Ignored when
   * `waitForInput` is true (the overlay then persists until the player
   * actually performs an input gesture).
   */
  durationMs: number;
  /**
   * When true, the overlay does NOT auto-dismiss on a timer; it stays
   * visible until the player clicks, taps, or presses a key. Used for
   * brand-new players so the hint can't disappear before they're ready.
   */
  waitForInput?: boolean;
  /** Optional callback fired after the overlay has finished fading out. */
  onComplete?: () => void;
}

export class ReadyOverlay {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private inputListener: ((e: Event) => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: ReadyOverlayOptions): void {
    this.hide();
    const wrap = document.createElement('div');
    wrap.className = 'ready-overlay';
    const ctaText = opts.waitForInput ? 'CLICK / TAP TO START' : 'GET READY';
    wrap.innerHTML = `
      <div class="ready-badge">${ctaText}</div>
      <div class="ready-hint">${escapeHtml(opts.inputHint)}</div>
    `;
    this.root.appendChild(wrap);
    this.el = wrap;

    if (opts.waitForInput) {
      // First-time player: hold the badge until they actually gesture.
      // The listener fires on the FIRST pointerdown / keydown anywhere
      // on the document — including the canvas, the touch buttons, etc.
      // The grace window in Game.ts also waits for this signal via the
      // `onComplete` callback.
      const listener = (): void => {
        this.dismissNow(opts.onComplete);
      };
      this.inputListener = listener;
      // `capture: true` so we hear the event even if downstream stops it.
      document.addEventListener('pointerdown', listener, { once: true, capture: true });
      document.addEventListener('keydown', listener, { once: true, capture: true });
      document.addEventListener('touchstart', listener, { once: true, capture: true });
      return;
    }

    const visibleMs = Math.max(200, opts.durationMs - 220);
    this.timer = setTimeout(() => {
      this.dismissNow(opts.onComplete);
    }, visibleMs);
  }

  private dismissNow(onComplete?: () => void): void {
    this.beginFade();
    onComplete?.();
  }

  private beginFade(): void {
    if (!this.el) return;
    this.el.classList.add('ready-overlay-out');
    const el = this.el;
    this.el = null;
    this.fadeTimer = setTimeout(() => el.remove(), 240);
  }

  hide(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.inputListener) {
      document.removeEventListener('pointerdown', this.inputListener, true);
      document.removeEventListener('keydown', this.inputListener, true);
      document.removeEventListener('touchstart', this.inputListener, true);
      this.inputListener = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
