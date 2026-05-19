export class ToastManager {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(message: string, durationMs: number = 2200): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    this.root.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 320ms ease, transform 320ms ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 340);
    }, durationMs);
  }
}
