/**
 * Pre-roll "GET READY" overlay shown at the start of every run.
 *
 * The first 90 seconds of a session are make-or-break for a portal reviewer,
 * and the original flow dropped the player into live physics the instant
 * they clicked PLAY — gravity from frame 0, ~0.5s until lava contact if they
 * froze. This component gives them a calm beat to read the screen, see the
 * control hint, and engage on their own terms.
 *
 * Visual: a full-screen non-blocking layer with a large "GET READY" badge
 * and a single-line control hint. Auto-dismisses after `durationMs`.
 *
 * The overlay uses `pointer-events: none` so it never eats the first input —
 * a player who's ready to grapple can already be moving the mouse / lining
 * up a tap. Game.ts is responsible for honoring the grace window in physics.
 */
export interface ReadyOverlayOptions {
  /** One-line hint placed under the badge (control prompt). */
  inputHint: string;
  /** How long the overlay stays visible, in ms. */
  durationMs: number;
  /** Optional callback fired after the overlay has finished fading out. */
  onComplete?: () => void;
}

export class ReadyOverlay {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: ReadyOverlayOptions): void {
    this.hide();
    const wrap = document.createElement('div');
    wrap.className = 'ready-overlay';
    wrap.innerHTML = `
      <div class="ready-badge">GET READY</div>
      <div class="ready-hint">${escapeHtml(opts.inputHint)}</div>
    `;
    this.root.appendChild(wrap);
    this.el = wrap;
    const visibleMs = Math.max(200, opts.durationMs - 220);
    this.timer = setTimeout(() => {
      this.beginFade();
      // Fire onComplete in lockstep with the fade so the gameplay grace
      // ending visually aligns with the overlay disappearing.
      opts.onComplete?.();
    }, visibleMs);
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
