/**
 * Mid-run trick banner. A single short-lived DOM element overlaid on the
 * canvas; CSS animates pop-in / drift-out. We deliberately do NOT use the
 * world-space floating-text system here — tricks want big, screen-anchored
 * branding that reads as a UI moment, not a particle.
 */

export class TrickCalloutManager {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  /**
   * Show a callout. The element auto-removes when its CSS animation ends, so
   * callers don't need to track returned handles.
   */
  show(name: string, color: string, score: number): void {
    const el = document.createElement('div');
    el.className = 'trick-callout';
    el.style.setProperty('--trick-color', color);
    el.innerHTML = `${this.escape(name)}<em>+${Math.floor(score)}</em>`;
    this.root.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    // Safety: if animation events are missed (rare), remove after 1.4s.
    setTimeout(() => {
      if (el.isConnected) el.remove();
    }, 1400);
  }

  /** Clear any pending callouts (used on retry / mode swap). */
  clear(): void {
    const els = this.root.querySelectorAll('.trick-callout');
    els.forEach((el) => el.remove());
  }

  private escape(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
    );
  }
}
