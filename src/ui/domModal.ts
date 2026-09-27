/**
 * The DOM modal layer (ARCHITECTURE §2, §7b): the only DOM UI in the game, because typing needs a real input
 * (the iPhone keyboard, paste, select-all). Used for Enter Seed and Settings → Export / Import save.
 *
 * One modal at a time: a fixed full-viewport layer (marked `data-sd-modal`, above the canvas, so no touch
 * reaches the game) holding a pixel-styled panel placed inside the game image. Text selection and typing are
 * allowed inside it only; the game's keyboard handler ignores keys aimed at it (engine/input.ts). While it is
 * open `onChange(true)` lets main.ts push a canvas scene that blocks the game's buttons and keys.
 *
 * iPhone polish (batch 3): the panel is placed against the VISUAL viewport (the keyboard shrinks it: `visualViewport`
 * resize / scroll re-place it) and, in portrait, against the whole screen instead of the (tiny) game image — main.ts
 * re-places it whenever the display changes and keeps the rotate card out from behind it. A modal may skip the
 * auto-focus and put its actions above the field (Import: PASTE reads the clipboard inside the tap). A backdrop tap
 * only dismisses the keyboard while the field holds typed text (a pasted 14 KB code is never thrown away by a stray
 * tap); it cancels when the field is empty. No pinch-zoom inside (`touch-action: pan-x pan-y`; gesture events are
 * blocked by engine/input.ts), so the game can never be left zoomed in.
 */

import type { Display } from '../engine/display';

export type ModalKind = 'seed' | 'export' | 'import';

export interface ModalAction {
  id: string;
  label: string;
  kind?: 'primary' | 'danger' | 'plain';
  run(): void;
}

export interface ModalField {
  multiline: boolean;
  value: string;
  placeholder?: string;
  readonly?: boolean;
  maxLength?: number;
  rows?: number;
  /** Seed entry: uppercase, big letter-spaced text. */
  seed?: boolean;
}

export interface ModalSpec {
  kind: ModalKind;
  title: string;
  /** Paragraphs (one per string). */
  text: string[];
  field?: ModalField;
  /** A small line under the field (hints, practice-run note). */
  note?: string;
  actions: ModalAction[];
  /** Enter in a single-line field. */
  submit?: () => void;
  /** Focus the field when the modal opens (raises the iPhone keyboard); default true. Import: false. */
  autoFocus?: boolean;
  /** The action row above the field instead of below it (Import: reachable over the iPhone keyboard). */
  actionsFirst?: boolean;
  /** Escape / tapping outside the panel. */
  cancel: () => void;
  /** The field changed (live validation). */
  onInput?: (value: string) => void;
}

const CSS = `
[data-sd-modal]{position:fixed;inset:0;z-index:20;background:rgba(4,5,10,.45);touch-action:pan-x pan-y;
  -webkit-user-select:none;user-select:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  -webkit-text-size-adjust:100%;overflow:auto;overscroll-behavior:contain}
.sdm-panel{position:absolute;box-sizing:border-box;background:#1a2031;border:3px solid #56648a;border-radius:2px;touch-action:pan-x pan-y;
  box-shadow:0 4px 0 #07080d,inset 0 2px 0 #2a3350;color:#e9edf7;padding:12px 14px 12px;text-transform:uppercase;
  letter-spacing:.05em}
.sdm-title{color:#ffcf57;font-weight:700;font-size:18px;margin:0 0 6px;text-shadow:2px 2px 0 #2a1a08}
.sdm-text{font-size:12px;line-height:1.45;margin:0 0 6px;color:#c9d3f0}
.sdm-field{display:block;box-sizing:border-box;width:100%;margin:4px 0 4px;background:#0b0f18;color:#fff3c4;
  border:2px solid #56648a;border-radius:0;padding:8px 10px;font:600 16px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  -webkit-user-select:text;user-select:text;touch-action:auto;-webkit-touch-callout:default;outline:none;-webkit-appearance:none;appearance:none}
.sdm-field:focus{border-color:#ffd76a}
.sdm-seed{font-size:24px;letter-spacing:.3em;text-transform:uppercase;text-align:center}
textarea.sdm-field{font-size:12px;line-height:1.35;word-break:break-all;resize:none;text-transform:none;letter-spacing:0}
.sdm-note{font-size:11px;color:#8e98b5;margin:2px 0 4px;min-height:14px}
.sdm-error{color:#ff8a8a}
.sdm-ok{color:#8fe0a0}
.sdm-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px}
.sdm-actions-top{margin:4px 0 8px}
.sdm-btn{min-height:44px;min-width:92px;padding:0 14px;background:#1a2031;color:#e9edf7;border:2px solid #56648a;
  border-radius:0;box-shadow:0 3px 0 #07080d;font:700 15px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  text-transform:uppercase;letter-spacing:.05em;touch-action:manipulation;cursor:pointer;-webkit-appearance:none;appearance:none}
.sdm-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #07080d}
.sdm-btn:focus-visible{outline:2px solid #ffcf57;outline-offset:2px}
.sdm-primary{background:#2b3553;border-color:#ffd76a;color:#fff3c4}
.sdm-danger{background:#3a1c24;border-color:#e0515a;color:#ffd0d0}
`;

let styled = false;

export class DomModal {
  private readonly display: Display;
  private root: HTMLDivElement | null = null;
  private panel: HTMLDivElement | null = null;
  private fieldEl: HTMLInputElement | HTMLTextAreaElement | null = null;
  private noteEl: HTMLDivElement | null = null;
  private spec: ModalSpec | null = null;
  /** Main.ts: a modal opened (true) / closed (false). */
  onChange: ((open: boolean) => void) | null = null;
  /** The visual viewport listeners while open (the iPhone keyboard moves / shrinks it). */
  private viewportHooked = false;
  private readonly onViewport = (): void => this.place();

  constructor(display: Display) {
    this.display = display;
  }

  get isOpen(): boolean {
    return this.root !== null;
  }

  get kind(): ModalKind | null {
    return this.spec?.kind ?? null;
  }

  /** The field's text ('' without a field). */
  get value(): string {
    return this.fieldEl?.value ?? '';
  }

  /** The note line's text and whether it shows an error (tests). */
  get note(): { text: string; error: boolean } {
    return { text: this.noteEl?.textContent ?? '', error: this.noteEl?.classList.contains('sdm-error') ?? false };
  }

  /** Opens a modal (replacing the content of one already open — e.g. the import confirmation). */
  open(spec: ModalSpec): void {
    const reopen = this.root !== null;
    if (!styled) {
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
      styled = true;
    }
    if (!this.root) {
      const root = document.createElement('div');
      root.setAttribute('data-sd-modal', spec.kind);
      root.addEventListener('pointerdown', (e) => {
        if (e.target !== root) return;
        // A tap on the dimmed backdrop (outside the panel): with typed / pasted text in the field it only dismisses
        // the keyboard (what a tap outside means on a phone); an empty field cancels.
        const el = this.fieldEl;
        if (el && !el.readOnly && el.value.trim() !== '') {
          if (document.activeElement === el) el.blur();
          return;
        }
        this.spec?.cancel();
      });
      root.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.spec?.cancel();
        }
      });
      document.body.appendChild(root);
      this.root = root;
    }
    this.root.setAttribute('data-sd-modal', spec.kind);
    this.root.textContent = '';
    this.spec = spec;

    const panel = document.createElement('div');
    panel.className = 'sdm-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', spec.title);
    const h = document.createElement('div');
    h.className = 'sdm-title';
    h.textContent = spec.title;
    panel.appendChild(h);
    for (const t of spec.text) {
      const p = document.createElement('div');
      p.className = 'sdm-text';
      p.textContent = t;
      panel.appendChild(p);
    }
    this.fieldEl = null;
    const actions = document.createElement('div');
    actions.className = `sdm-actions${spec.actionsFirst ? ' sdm-actions-top' : ''}`;
    for (const a of spec.actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `sdm-btn${a.kind === 'primary' ? ' sdm-primary' : a.kind === 'danger' ? ' sdm-danger' : ''}`;
      b.textContent = a.label;
      b.setAttribute('data-action', a.id);
      b.addEventListener('click', (e) => {
        e.preventDefault();
        a.run();
      });
      actions.appendChild(b);
    }
    if (spec.actionsFirst) panel.appendChild(actions);
    if (spec.field) {
      const f = spec.field;
      const el = f.multiline ? document.createElement('textarea') : document.createElement('input');
      el.className = `sdm-field${f.seed ? ' sdm-seed' : ''}`;
      el.value = f.value;
      if (f.placeholder) el.placeholder = f.placeholder;
      if (f.readonly) el.readOnly = true;
      if (f.maxLength) el.maxLength = f.maxLength;
      if (el instanceof HTMLTextAreaElement) el.rows = f.rows ?? 4;
      else {
        el.type = 'text';
        el.enterKeyHint = 'go';
      }
      el.autocomplete = 'off';
      el.spellcheck = false;
      el.setAttribute('autocorrect', 'off');
      el.setAttribute('autocapitalize', f.seed ? 'characters' : 'off');
      el.addEventListener('keydown', (e) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter' && !f.multiline) {
          ke.preventDefault();
          this.spec?.submit?.();
        }
      });
      el.addEventListener('input', () => {
        if (f.seed) {
          // Uppercase as they type (keeping the caret where it was).
          const pos = (el as HTMLInputElement).selectionStart;
          const up = el.value.toUpperCase();
          if (up !== el.value) {
            el.value = up;
            if (pos !== null) (el as HTMLInputElement).setSelectionRange(pos, pos);
          }
        }
        this.spec?.onInput?.(el.value);
      });
      panel.appendChild(el);
      this.fieldEl = el;
    }
    const note = document.createElement('div');
    note.className = 'sdm-note';
    note.textContent = spec.note ?? '';
    panel.appendChild(note);
    this.noteEl = note;
    if (!spec.actionsFirst) panel.appendChild(actions);
    this.root.appendChild(panel);
    this.panel = panel;
    this.hookViewport(true);
    this.place();
    if (!reopen) this.onChange?.(true);
    // Focus the field right away: the modal opens inside the tap's pointerup / the key press, and iOS only
    // raises the keyboard for a focus made during a user gesture. A read-only code gets selected. (Import skips it:
    // the keyboard would cover its buttons, and PASTE needs none.)
    const el = this.fieldEl;
    if (el && spec.autoFocus !== false) {
      el.focus({ preventScroll: true });
      if (el.readOnly) this.selectAll();
      // Some browsers refuse a focus while the canvas still holds the pointer capture: try once more.
      setTimeout(() => {
        if (this.fieldEl === el && document.activeElement !== el) el.focus({ preventScroll: true });
      }, 60);
    }
  }

  /**
   * Places the panel (on open, whenever the display changes — main.ts — and when the visual viewport moves). Landscape:
   * inside the game image. Portrait: across the whole screen under the safe-area top (the game image is tiny there).
   * Either way it stays inside the VISUAL viewport, so the iPhone keyboard never hides it: it gets shorter and scrolls.
   */
  place(): void {
    const p = this.panel;
    if (!p) return;
    const r = modalRect(this.display, visibleViewport());
    p.style.width = `${Math.round(r.w)}px`;
    p.style.left = `${Math.round(r.x)}px`;
    p.style.top = `${Math.round(r.y)}px`;
    p.style.maxHeight = `${Math.round(r.maxH)}px`;
    p.style.overflowY = 'auto';
  }

  /** The panel's rect in CSS px (tests / __SD), null when closed. */
  get panelRect(): { x: number; y: number; w: number; h: number } | null {
    const b = this.panel?.getBoundingClientRect();
    return b ? { x: b.left, y: b.top, w: b.width, h: b.height } : null;
  }

  private hookViewport(on: boolean): void {
    const vv = typeof window === 'undefined' ? undefined : window.visualViewport;
    if (!vv || on === this.viewportHooked) return;
    this.viewportHooked = on;
    if (on) {
      vv.addEventListener('resize', this.onViewport);
      vv.addEventListener('scroll', this.onViewport);
    } else {
      vv.removeEventListener('resize', this.onViewport);
      vv.removeEventListener('scroll', this.onViewport);
    }
  }

  /** Replaces the field's text (PASTE) and reports it like typing would. */
  setValue(text: string): void {
    const el = this.fieldEl;
    if (!el) return;
    el.value = text;
    this.spec?.onInput?.(text);
  }

  /** Focuses the field (a paste that was refused: the player pastes by hand). */
  focusField(): void {
    this.fieldEl?.focus({ preventScroll: true });
  }

  /**
   * Reads the clipboard into the field. Must be called inside the tap (iOS shows its Paste callout for it); resolves
   * with the text, or null when the browser refused / has no clipboard API / the modal closed meanwhile.
   */
  pasteFromClipboard(): Promise<string | null> {
    const clip = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (!clip?.readText) return Promise.resolve(null);
    let read: Promise<string>;
    try {
      read = clip.readText();
    } catch {
      return Promise.resolve(null);
    }
    const field = this.fieldEl;
    return read.then(
      (text) => {
        if (!this.isOpen || this.fieldEl !== field) return null;
        this.setValue(text);
        return text;
      },
      () => null,
    );
  }

  setNote(text: string, tone: 'plain' | 'error' | 'ok' = 'plain'): void {
    const n = this.noteEl;
    if (!n) return;
    n.textContent = text;
    n.classList.toggle('sdm-error', tone === 'error');
    n.classList.toggle('sdm-ok', tone === 'ok');
  }

  selectAll(): void {
    const el = this.fieldEl;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
    try {
      el.setSelectionRange(0, el.value.length);
    } catch {
      /* not selectable (type) — select() did it */
    }
  }

  /** Copies the field's text: the Clipboard API, else the old select + copy command. */
  async copy(): Promise<boolean> {
    const text = this.value;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* permission / insecure context: fall back */
    }
    try {
      this.selectAll();
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }

  close(): void {
    if (!this.root) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.root.contains(active)) active.blur();
    this.hookViewport(false);
    this.root.remove();
    this.root = null;
    this.panel = null;
    this.fieldEl = null;
    this.noteEl = null;
    this.spec = null;
    this.onChange?.(false);
  }

  /** Escape from the game side (the field wasn't focused): cancel like the modal's own Escape. */
  cancel(): void {
    this.spec?.cancel();
  }
}

/** The visible part of the page (CSS px): the visual viewport (the keyboard shrinks it), else the window. */
export interface VisibleArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

function visibleViewport(): VisibleArea {
  const vv = typeof window === 'undefined' ? undefined : window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) return { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height };
  const w = typeof window === 'undefined' ? 0 : window.innerWidth;
  const h = typeof window === 'undefined' ? 0 : window.innerHeight;
  return { x: 0, y: 0, w, h };
}

/**
 * Where the panel goes (pure, for tests): landscape — centred over the game image, 8 px under its top; portrait — the
 * screen's width less 24 px, under the safe-area top. `maxH` keeps it inside the visible area (it scrolls inside).
 */
export function modalRect(
  d: Pick<Display, 'portrait' | 'view' | 'safe'>,
  area: VisibleArea,
): { x: number; y: number; w: number; maxH: number } {
  if (d.portrait) {
    const w = Math.max(200, area.w - 24);
    const y = area.y + d.safe.top + 8;
    const bottom = area.y + area.h - Math.max(8, d.safe.bottom);
    return { x: area.x + (area.w - w) / 2, y, w, maxH: Math.max(120, bottom - y) };
  }
  const v = d.view;
  const w = Math.max(200, Math.min(560, Math.max(260, v.w - 40), area.w - 16));
  const x = Math.max(area.x + 8, Math.min(v.x + (v.w - w) / 2, area.x + area.w - 8 - w));
  const y = Math.max(v.y + 8, area.y + 8);
  const bottom = Math.min(v.y + v.h - 8, area.y + area.h - 8);
  return { x, y, w, maxH: Math.max(120, bottom - y) };
}

/** Is this event target inside the DOM modal layer (the game ignores keys / gestures aimed at it)? */
export function inModal(target: EventTarget | null): boolean {
  return typeof Element !== 'undefined' && target instanceof Element && target.closest('[data-sd-modal]') !== null;
}
