/**
 * PWA helpers: opt-in service-worker installation triggered from the Settings menu.
 * We deliberately do NOT auto-register on load to avoid breaking first-load on CrazyGames.
 */
export const installPWA = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
    return true;
  } catch (err) {
    console.warn('SW install failed', err);
    return false;
  }
};

export const uninstallPWA = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
};
