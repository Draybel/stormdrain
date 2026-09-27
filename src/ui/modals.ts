/**
 * The DOM modal flows (Phase 4B): Enter Seed (→ character select), Export save (the `SD1:` code, select all +
 * copy) and Import save (validate → confirm → replace). While one is open the canvas shows {@link ModalScene}:
 * the scene below dimmed, no buttons, every key swallowed (Escape cancels).
 *
 * Import on an iPhone (polish batch 3): it opens WITHOUT focusing the field (the keyboard would hide its buttons),
 * with its buttons above the field and a primary PASTE that reads the clipboard inside the tap and checks the code at
 * once; a refused paste falls back to pasting by hand (long-press the box). This modal is the only way to move saves
 * between Safari and the home-screen app.
 */

import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { summarizeMeta } from '../meta/exportCode';
import { toRuntimeSettings } from '../meta/metaState';
import { formatSeed, validateSeed } from '../meta/seedCode';
import { TOAST_NOTICE } from '../render/toasts';
import type { App } from './app';
import type { Scene } from './scene';
import type { UiButton } from './widgets';

/** The canvas side of an open DOM modal: dims what's below, blocks the game's buttons and keys. */
export class ModalScene implements Scene {
  readonly name = 'modal';
  readonly overlay = true;
  readonly wantsSticks = false;
  readonly buttons: UiButton[] = [];
  private readonly app: App;
  private t = 0;

  constructor(app: App) {
    this.app = app;
  }

  onKey(code: string): boolean {
    if (code === 'Escape') this.app.modal.cancel();
    return true;
  }

  update(dt: number, _input: InputState): void {
    // (The panel follows the display — main.ts re-places it on every layout change, portrait included — and the
    // visual viewport — the modal's own listeners — so there is nothing to do per tick.)
    this.t += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = Math.min(0.6, this.t * 5);
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalAlpha = 1;
  }
}

const SEED_NOTE = 'A SEEDED RUN IS PRACTICE: SINGLE-RUN ACHIEVEMENTS AND ENDINGS DON’T COUNT.';

/** Title → ENTER SEED: type a code, then pick a character. */
export function openSeedEntry(app: App): void {
  const m = app.modal;
  const submit = (): void => {
    const r = validateSeed(m.value);
    if (!r.ok) {
      m.setNote(r.error, 'error');
      app.audio.play('ui_back');
      return;
    }
    app.audio.play('menu_select');
    m.close();
    app.nav.characters({ code: r.code, kind: 'custom' });
  };
  m.open({
    kind: 'seed',
    title: 'Enter a seed',
    text: ['8 letters or digits, like ABCD 1234. The same seed always digs the same drains.'],
    field: { multiline: false, value: '', placeholder: 'ABCD 1234', maxLength: 12, seed: true },
    note: SEED_NOTE,
    actions: [
      { id: 'cancel', label: 'Cancel', run: () => cancel() },
      { id: 'start', label: 'Next', kind: 'primary', run: submit },
    ],
    submit,
    cancel: () => cancel(),
    onInput: (v) => {
      const r = validateSeed(v);
      if (r.ok) m.setNote(`SEED ${formatSeed(r.code)} · READY`, 'ok');
      else if (v.trim() === '') m.setNote(SEED_NOTE);
      else m.setNote(r.error, r.error.startsWith('ONLY') ? 'error' : 'plain');
    },
  });
  const cancel = (): void => {
    app.audio.play('ui_back');
    m.close();
  };
}

/** Settings → EXPORT SAVE: the code, with select-all and copy. */
export function openExport(app: App): void {
  const m = app.modal;
  let code: string;
  try {
    code = app.save.exportCode();
  } catch (err) {
    console.warn('export failed', err);
    app.toasts.push(TOAST_NOTICE, "COULDN'T EXPORT", 'THE SAVE COULD NOT BE READ');
    return;
  }
  const close = (): void => {
    app.audio.play('ui_back');
    m.close();
  };
  m.open({
    kind: 'export',
    title: 'Export save',
    text: [
      'Copy this code and keep it somewhere safe. Import it on another device, or in the home-screen app, to bring your progress along.',
    ],
    field: { multiline: true, value: code, readonly: true, rows: 4 },
    note: `${code.length} CHARACTERS · INCLUDES YOUR SAVED RUN IF THERE IS ONE`,
    actions: [
      {
        id: 'select',
        label: 'Select all',
        run: () => {
          m.selectAll();
          m.setNote('SELECTED · USE YOUR DEVICE’S COPY', 'plain');
        },
      },
      {
        id: 'copy',
        label: 'Copy',
        kind: 'primary',
        run: () => {
          void m.copy().then((ok) => {
            if (ok) {
              app.audio.play('menu_select');
              m.setNote('COPIED TO THE CLIPBOARD', 'ok');
            } else {
              m.setNote('COPY WAS BLOCKED · SELECT ALL AND COPY IT BY HAND', 'error');
            }
          });
        },
      },
      { id: 'done', label: 'Done', run: close },
    ],
    cancel: close,
  });
}

export const PASTE_REFUSED = 'PASTE WAS BLOCKED · LONG-PRESS THE BOX, PASTE, THEN CHECK CODE';

/** Settings → IMPORT SAVE: paste, check, confirm, replace. `done` runs after a successful import. */
export function openImport(app: App, done: () => void): void {
  const m = app.modal;
  const close = (): void => {
    app.audio.play('ui_back');
    m.close();
  };
  // Inside the tap: iOS shows its Paste callout for readText(); the code is checked the moment it arrives.
  const paste = (): void => {
    void m.pasteFromClipboard().then((text) => {
      if (m.kind !== 'import') return;
      if (text === null) {
        m.setNote(PASTE_REFUSED, 'error');
        m.focusField();
      } else if (text.trim() === '') {
        m.setNote('THE CLIPBOARD IS EMPTY · COPY YOUR CODE FIRST', 'error');
      } else {
        check();
      }
    });
  };
  const ask = (text: string): void => {
    m.open({
      kind: 'import',
      title: 'Import save',
      text: ['Copy your save code (it starts with SD1:), then tap PASTE. Importing replaces ALL progress on this device.'],
      field: { multiline: true, value: text, placeholder: 'SD1:...', rows: 3 },
      autoFocus: false,
      actionsFirst: true,
      actions: [
        { id: 'cancel', label: 'Cancel', run: close },
        { id: 'check', label: 'Check code', run: () => check() },
        { id: 'paste', label: 'Paste', kind: 'primary', run: paste },
      ],
      cancel: close,
      onInput: () => m.setNote(''),
    });
  };
  const check = (): void => {
    const text = m.value;
    const r = app.save.checkImport(text);
    if (!r.ok) {
      app.audio.play('ui_back');
      m.setNote(r.message.toUpperCase(), 'error');
      return;
    }
    const s = summarizeMeta(r.meta);
    const hours = s.playTimeSec >= 3600 ? `${(s.playTimeSec / 3600).toFixed(1)} H` : `${Math.round(s.playTimeSec / 60)} MIN`;
    const n = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;
    const lines = [
      `This code holds: ${n(s.achievements, 'achievement', 'achievements')}, ${n(s.itemsDiscovered, 'item', 'items')} discovered, ${n(s.runs, 'run', 'runs')}, ${n(s.wins, 'win', 'wins')}, ${hours} played${r.run ? ', and a run in progress' : ''}.`,
      'Replace everything on this device with it? This cannot be undone.',
      ...r.warnings,
    ];
    app.audio.play('menu_select');
    m.open({
      kind: 'import',
      title: 'Replace your progress?',
      text: lines,
      actions: [
        { id: 'back', label: 'Back', run: () => ask(text) },
        {
          id: 'replace',
          label: 'Replace',
          kind: 'danger',
          run: () => {
            app.save.applyImport(r);
            app.settings.update(toRuntimeSettings(app.save.meta.settings));
            app.audio.play('menu_select');
            app.toasts.push(TOAST_NOTICE, 'SAVE IMPORTED', r.run ? 'YOUR RUN IS READY TO CONTINUE' : 'WELCOME BACK');
            m.close();
            done();
          },
        },
      ],
      cancel: close,
    });
  };
  ask('');
}
