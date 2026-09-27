/**
 * Service-worker registration (offline play + home-screen app). Call once from `main.ts` after
 * boot; it is a no-op outside production builds, on insecure origins and where service workers
 * are unavailable, and it never throws.
 *
 * Updates are quiet: when a new version finishes installing in the background, the page tells it
 * to take over (`SKIP_WAITING`). The running game keeps the code it already loaded (it is never
 * reloaded mid-run); the next launch starts the new version. `onUpdate` lets the title screen
 * mention "Updated: restart to play the new version" if it wants to.
 */

export interface RegisterOptions {
  /** Worker URL, relative to the page (default `./sw.js`: works under a GitHub Pages sub-path). */
  url?: string;
  /** Register even in development/test builds (tests pass a fake `container`). */
  force?: boolean;
  /** Called once when the app is fully cached for offline use (first install). */
  onOfflineReady?: () => void;
  /** Called when a new version has been installed and activated in the background. */
  onUpdate?: () => void;
  /** Minimum time between update checks when the app returns to the foreground. Default 1 h. */
  recheckMs?: number;
  /** Injected for tests (defaults to `navigator.serviceWorker`). */
  container?: WorkerContainerLike;
}

/** The parts of the DOM service-worker API we use (so tests can pass fakes). */
export interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', fn: () => void): void;
}

export interface RegistrationLike {
  installing: WorkerLike | null;
  waiting: WorkerLike | null;
  active: WorkerLike | null;
  update(): Promise<unknown>;
  addEventListener(type: 'updatefound', fn: () => void): void;
}

export interface WorkerContainerLike {
  readonly controller: unknown;
  register(url: string, options?: { scope?: string; updateViaCache?: 'all' | 'imports' | 'none' }): Promise<RegistrationLike>;
}

export const SKIP_WAITING = { type: 'SKIP_WAITING' } as const;

export async function registerServiceWorker(opts: RegisterOptions = {}): Promise<RegistrationLike | null> {
  try {
    if (!opts.force && !import.meta.env.PROD) return null;
    const container = opts.container ?? defaultContainer();
    if (!container) return null;
    if (!opts.container && typeof window !== 'undefined' && !window.isSecureContext) return null;
    if (!opts.container) await afterLoad();

    const reg = await container.register(opts.url ?? './sw.js', { scope: './', updateViaCache: 'none' });
    let offlineReported = false;
    let updateReported = false;
    const watched = new WeakSet<WorkerLike>();

    const watch = (w: WorkerLike | null): void => {
      if (!w || watched.has(w)) return;
      watched.add(w);
      // An update = a new worker arriving while another version already runs this app. A first install claims the
      // page itself (WebKit may deliver the 'installed' statechange after that claim): its own control is no update.
      const olderVersion = (): boolean =>
        (!!container.controller && container.controller !== w) || (!!reg.active && reg.active !== w);
      let isUpdate = olderVersion();
      const check = (): void => {
        if (w.state === 'installed') {
          isUpdate = olderVersion();
          // Waiting behind the running version: let it take over quietly (no reload).
          if (isUpdate) w.postMessage(SKIP_WAITING);
        } else if (w.state === 'activated') {
          if (isUpdate) {
            if (!updateReported) {
              updateReported = true;
              opts.onUpdate?.();
            }
          } else if (!offlineReported) {
            offlineReported = true;
            opts.onOfflineReady?.();
          }
        }
      };
      w.addEventListener('statechange', check);
      check();
    };

    watch(reg.waiting);
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));

    installForegroundRecheck(reg, opts.recheckMs ?? 3_600_000);
    return reg;
  } catch (err) {
    console.warn('service worker registration failed', err);
    return null;
  }
}

function defaultContainer(): WorkerContainerLike | null {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker as unknown as WorkerContainerLike;
}

/** Don't compete with the game's own startup for bandwidth. */
function afterLoad(): Promise<void> {
  if (typeof document === 'undefined' || document.readyState === 'complete') return Promise.resolve();
  return new Promise((res) => window.addEventListener('load', () => res(), { once: true }));
}

/** Home-screen apps stay resident for days: look for updates when brought back to the front. */
function installForegroundRecheck(reg: RegistrationLike, minGapMs: number): void {
  if (typeof document === 'undefined') return;
  let last = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < minGapMs) return;
    last = Date.now();
    reg.update().catch(() => {});
  });
}
