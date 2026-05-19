import { Game } from './game/Game';
import './styles/main.css';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const uiRoot = document.getElementById('ui-root');
const touchRoot = document.getElementById('touch-root');
const overlayRoot = document.getElementById('overlay-root');
const toastRoot = document.getElementById('toast-root');

if (!canvas || !uiRoot || !touchRoot || !overlayRoot || !toastRoot) {
  throw new Error('Missing required DOM nodes for game bootstrap.');
}

const game = new Game({
  canvas,
  uiRoot,
  touchRoot,
  overlayRoot,
  toastRoot,
});

// Disable pull-to-refresh / overscroll on Safari.
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// Expose for debugging in console
(window as unknown as { __game: Game }).__game = game;
