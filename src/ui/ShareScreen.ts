import { GameMode } from '../game/GameState';
import { canvasToBlob, renderShareCard, type ShareCardData } from './ShareCard';

// The Web Share API isn't typed in lib.dom across all environments — declare a
// narrow shape we use, and cast at the use site instead of widening Navigator.
type WebShareData = { title?: string; text?: string; url?: string; files?: File[] };
interface WebShareApi {
  share?: (data: WebShareData) => Promise<void>;
  canShare?: (data: WebShareData) => boolean;
}

const SHARE_TEXT = (data: ShareCardData): string => {
  switch (data.mode) {
    case GameMode.TimeAttack:
      return `I cleared the Time Attack in ${data.elapsedSeconds.toFixed(2)}s on Grapple Gliders. Beat that.`;
    case GameMode.DailyChallenge:
      return data.dailyRank
        ? `Ranked #${data.dailyRank} on today's Grapple Gliders daily. Same seed for everyone — your turn.`
        : `Scored ${data.score.toLocaleString()} on today's Grapple Gliders daily. Beat that.`;
    case GameMode.ComboRun:
      return `Hit a ×${data.peakCombo} combo in 60 seconds on Grapple Gliders. Can you keep the chain alive?`;
    case GameMode.BotRace:
      return `Just beat the bots up to ${Math.floor(data.altitude)}m in Grapple Gliders.`;
    case GameMode.EndlessClimb:
    default:
      return `Climbed to ${Math.floor(data.altitude)}m in Grapple Gliders. Outrun the lava — try it.`;
  }
};

export class ShareScreen {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open(data: ShareCardData, onClose: () => void): void {
    this.close();
    const canvas = renderShareCard(data);
    const previewUrl = canvas.toDataURL('image/png');
    const shareText = SHARE_TEXT(data);
    const overlay = document.createElement('div');
    overlay.className = 'overlay-screen share-screen';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
        onClose();
      }
    });
    const nav = navigator as unknown as WebShareApi;
    const supportsNativeShare = typeof nav.share === 'function';
    overlay.innerHTML = `
      <div class="modal share-modal">
        <div class="modal-content">
          <h1 class="title gradient-text">Share Your Run</h1>
          <p class="subtitle">Drop the card in your group chat. Daily-style boasts age beautifully.</p>
          <div class="share-preview-wrap">
            <img src="${previewUrl}" alt="Grapple Gliders run summary" class="share-preview" />
          </div>
          <div class="share-text-row">
            <textarea class="share-text" rows="2" readonly>${this.escape(shareText)}\n${data.gameUrl}</textarea>
          </div>
          <div class="actions">
            ${supportsNativeShare ? '<button class="primary" data-el="native">Share…</button>' : ''}
            <button class="primary" data-el="copy">Copy Text</button>
            <button class="ghost" data-el="download">Download Image</button>
            <button class="ghost" data-el="close">Back</button>
          </div>
          <p class="subtitle share-hint" data-el="status"></p>
        </div>
      </div>
    `;
    this.root.appendChild(overlay);
    this.el = overlay;

    const status = overlay.querySelector<HTMLParagraphElement>('[data-el="status"]')!;
    const showStatus = (msg: string): void => {
      status.textContent = msg;
      status.classList.add('visible');
      setTimeout(() => status.classList.remove('visible'), 2400);
    };

    overlay.querySelector('[data-el="close"]')!.addEventListener('click', () => {
      this.close();
      onClose();
    });

    overlay.querySelector('[data-el="copy"]')!.addEventListener('click', async () => {
      const payload = `${shareText}\n${data.gameUrl}`;
      try {
        await navigator.clipboard.writeText(payload);
        showStatus('Copied! Paste it anywhere.');
      } catch {
        // Fallback: select the textarea for a manual copy.
        const ta = overlay.querySelector<HTMLTextAreaElement>('.share-text');
        ta?.select();
        showStatus('Press Ctrl/Cmd-C to copy.');
      }
    });

    overlay.querySelector('[data-el="download"]')!.addEventListener('click', async () => {
      const blob = await canvasToBlob(canvas);
      if (!blob) {
        showStatus('Could not generate the image.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grapple-gliders-run-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showStatus('Saved! Post it like a trophy.');
    });

    overlay.querySelector('[data-el="native"]')?.addEventListener('click', async () => {
      if (!nav.share) return;
      const blob = await canvasToBlob(canvas);
      const files: File[] | undefined =
        blob && typeof File !== 'undefined'
          ? [new File([blob], 'grapple-gliders.png', { type: 'image/png' })]
          : undefined;
      try {
        const payload: { title: string; text: string; url: string; files?: File[] } = {
          title: 'Grapple Gliders',
          text: shareText,
          url: data.gameUrl,
        };
        if (files && nav.canShare && nav.canShare({ files })) {
          payload.files = files;
        }
        await nav.share(payload);
        showStatus('Thanks for sharing!');
      } catch (err) {
        // User dismissed the picker — no need to surface that as an error.
        const e = err as { name?: string };
        if (e.name !== 'AbortError') {
          showStatus('Share cancelled.');
        }
      }
    });
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  private escape(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
    );
  }
}
