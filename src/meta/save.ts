/**
 * Save hooks. Phase 1 has nothing worth saving yet; Phase 4 implements the versioned envelope
 * (`stormdrain.run`, ARCHITECTURE §7) behind these same function names, so the call sites in the
 * lifecycle and pause paths are already in place.
 */

let saveCalls = 0;

/**
 * Persist the current run immediately. Called when the page goes to the background, when the
 * player pauses, and (Phase 3+) on every room transition.
 * TODO(Phase 4): serialize run state into localStorage `stormdrain.run`.
 */
export function saveRunNow(): void {
  saveCalls++;
}

/** Diagnostics for tests/debug overlay. */
export function saveRunCalls(): number {
  return saveCalls;
}
