export interface NamePromptCallbacks {
  onSave(name: string): void;
  onCancel(): void;
}

/**
 * Lightweight first-launch / "change name" overlay. Used as the entry point
 * for setting the leaderboard display name so we don't leave players as "YOU".
 */
export class NamePromptScreen {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(initial: string, cb: NamePromptCallbacks): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    const modal = document.createElement('div');
    modal.className = 'modal name-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:480px;margin:0 auto">
        <span class="eyebrow">Pick a Pilot Name</span>
        <h1 class="title gradient-text" style="font-size:clamp(28px,5vw,42px);margin-top:8px">Who's flying?</h1>
        <p class="subtitle" style="margin-bottom:18px">Used on the daily leaderboard and Bot Race. 1–16 characters — letters, numbers, dashes, underscores or spaces.</p>
        <div class="name-input-row">
          <input type="text" maxlength="16" class="name-input" data-el="input" placeholder="Pilot name" autocomplete="off" />
        </div>
        <p class="hint" data-el="err" style="color:var(--red);display:none">Pick a name with at least 1 letter or number.</p>
        <div class="actions" style="justify-content:flex-end">
          <button class="ghost" data-el="cancel">Maybe later</button>
          <button class="primary" data-el="save">Save</button>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;
    const input = modal.querySelector<HTMLInputElement>('[data-el="input"]')!;
    const err = modal.querySelector<HTMLElement>('[data-el="err"]')!;
    input.value = initial;
    // Defer focus until after the modal is on screen (avoids mobile keyboard flicker).
    setTimeout(() => input.focus(), 60);
    const sanitize = (raw: string): string =>
      raw.replace(/[^\p{L}\p{N}_\-. ]/gu, '').trim().slice(0, 16);
    const tryCommit = (): void => {
      const cleaned = sanitize(input.value);
      if (cleaned.length === 0) {
        err.style.display = 'block';
        return;
      }
      this.close();
      cb.onSave(cleaned);
    };
    modal.querySelector('[data-el="save"]')!.addEventListener('click', tryCommit);
    modal.querySelector('[data-el="cancel"]')!.addEventListener('click', () => {
      this.close();
      cb.onCancel();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') tryCommit();
      if (e.key === 'Escape') {
        this.close();
        cb.onCancel();
      }
    });
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
