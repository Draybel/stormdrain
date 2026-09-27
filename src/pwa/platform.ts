/**
 * Where the game runs (polish batch 3): an iPhone / iPad Safari TAB — whose storage WebKit may wipe after ~7 days
 * without a visit, and which keeps saves apart from the home-screen app — or the home-screen app itself (standalone).
 * Pure functions over a small environment record, so tests stub it; `readPlatform()` reads the real browser.
 *
 * - iOS / iPadOS WebKit: an iPhone / iPad / iPod user agent, or iPadOS 13+ in its "desktop" mode (a Mac user agent with
 *   touch points — no real Mac has a touch screen).
 * - Standalone (the home-screen app): `navigator.standalone === true` (Apple's own flag) or the display-mode media
 *   query (standalone / fullscreen: the manifest asks for fullscreen first).
 * - A Safari tab: iOS WebKit with touch, not standalone, and `navigator.standalone === false`. The flag exists only in
 *   iOS WebKit (it is false in a tab, true in the home-screen app), so a desktop or Android browser that merely
 *   borrows an iPhone user agent (dev tools, test browsers) is never told to "Add to Home Screen".
 */

export interface PlatformEnv {
  userAgent: string;
  /** `navigator.maxTouchPoints`. */
  maxTouchPoints: number;
  /** `navigator.standalone` (iOS WebKit only; undefined elsewhere). */
  standalone: boolean | undefined;
  /** `matchMedia('(display-mode: standalone)')` or `(display-mode: fullscreen)` matches. */
  displayStandalone: boolean;
}

export interface PlatformInfo {
  /** iPhone / iPad WebKit (any browser there: they are all WebKit). */
  ios: boolean;
  /** Runs as the home-screen app (standalone / fullscreen). */
  standalone: boolean;
  /** A Safari tab on an iPhone / iPad: saves may be wiped after ~7 days and are separate from the home-screen app's. */
  safariTab: boolean;
}

export function isIosWebKit(env: PlatformEnv): boolean {
  const ua = env.userAgent;
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return true;
  // iPadOS 13+ asks for desktop sites with a Mac user agent; only the iPad has touch points.
  return /\bMacintosh\b/.test(ua) && env.maxTouchPoints > 1;
}

export function isStandalone(env: PlatformEnv): boolean {
  return env.standalone === true || env.displayStandalone;
}

export function isIosSafariTab(env: PlatformEnv): boolean {
  return isIosWebKit(env) && env.maxTouchPoints > 0 && !isStandalone(env) && env.standalone === false;
}

export function platformInfo(env: PlatformEnv): PlatformInfo {
  return { ios: isIosWebKit(env), standalone: isStandalone(env), safariTab: isIosSafariTab(env) };
}

/** The browser's environment (safe in node: no navigator → a desktop-like record). */
export function readPlatformEnv(): PlatformEnv {
  const nav = (typeof navigator === 'undefined' ? undefined : navigator) as (Navigator & { standalone?: unknown }) | undefined;
  const mm = (q: string): boolean => {
    try {
      return typeof matchMedia === 'function' && matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  return {
    userAgent: nav?.userAgent ?? '',
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    standalone: typeof nav?.standalone === 'boolean' ? nav.standalone : undefined,
    displayStandalone: mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)'),
  };
}

export function readPlatform(): PlatformInfo {
  return platformInfo(readPlatformEnv());
}

/** The PWA side of the app (App.pwa): where it runs, whether the saves are protected, and a waiting update. */
export interface PwaState {
  readonly platform: PlatformInfo;
  /** This launch found no meta save at all (a brand-new install / browser): the home-screen app's import hint. */
  readonly firstLaunch: boolean;
  /** `navigator.storage.persist()` granted (null until known / unsupported → false). */
  persisted: boolean | null;
  /** A new version was installed and activated in the background: the title offers a reload. */
  updateReady: boolean;
  /** Saves (the run, if any, and meta), then reloads into the new version. */
  reload(): void;
}
