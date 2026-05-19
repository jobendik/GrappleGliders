export interface PauseCallbacks {
  onResume(): void;
  onRestart(): void;
  onExit(): void;
  onSettings(): void;
}

export class PauseMenu {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(cb: PauseCallbacks): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '420px';
    modal.innerHTML = `
      <div class="modal-content">
        <h1 class="title gradient-text" style="font-size:clamp(28px,5vw,52px)">Paused</h1>
        <p class="subtitle">The run is yours when you say go.</p>
        <div class="actions" style="flex-direction:column;align-items:stretch">
          <button class="primary" data-el="resume">Resume</button>
          <button class="ghost" data-el="restart">Restart</button>
          <button class="ghost" data-el="settings">Settings</button>
          <button class="ghost" data-el="exit">Back to Menu</button>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    this.root.appendChild(overlay);
    this.el = overlay;

    modal.querySelector('[data-el="resume"]')!.addEventListener('click', () => {
      this.close();
      cb.onResume();
    });
    modal.querySelector('[data-el="restart"]')!.addEventListener('click', () => {
      this.close();
      cb.onRestart();
    });
    modal.querySelector('[data-el="settings"]')!.addEventListener('click', cb.onSettings);
    modal.querySelector('[data-el="exit"]')!.addEventListener('click', () => {
      this.close();
      cb.onExit();
    });
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
