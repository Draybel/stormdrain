/**
 * Page lifecycle: going to the background (app switch, lock screen, tab hidden, focus lost)
 * must pause the run, save it and silence audio; coming back resumes audio (the run stays
 * paused behind the pause overlay until the player taps Resume).
 */

export type HideReason = 'hidden' | 'pagehide' | 'blur';

export interface LifecycleHandlers {
  onHide(reason: HideReason): void;
  onShow(): void;
}

export function installLifecycle(h: LifecycleHandlers): () => void {
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') h.onHide('hidden');
    else h.onShow();
  };
  const onPageHide = (): void => h.onHide('pagehide');
  const onBlur = (): void => h.onHide('blur');
  const onPageShow = (): void => {
    if (document.visibilityState !== 'hidden') h.onShow();
  };
  const onFocus = (): void => {
    if (document.visibilityState !== 'hidden') h.onShow();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('blur', onBlur);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('focus', onFocus);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('focus', onFocus);
  };
}
