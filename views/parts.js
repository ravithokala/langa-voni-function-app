// @ts-check

import { el, uk } from '../dom.js';
import { Money } from '../shared/money.js';
import { Stages } from '../shared/stages.js';

/** @param {string} text */
export const empty = (text) => el('p', { class: 'empty muted' }, text);

/** ₹1,23,456, or a dash when not known. @param {number|null|undefined} paise */
export const rupees = (paise) => (paise === null || paise === undefined ? '—' : Money.format(paise));

/** A progress bar. @param {number} part @param {number} whole @param {string} label */
export const meter = (part, whole, label) => {
  const percent = whole ? Math.round((part / whole) * 100) : 0;
  return el('div', { class: 'meter', role: 'img', 'aria-label': `${label}: ${percent} per cent` }, el('span', { style: { width: `${percent}%` } }));
};

/** The look of a stage: grey to start, amber on the way, rose when ready, green when done; red when late. @param {Item} item @param {string} today */
export function stageClass(item, today) {
  if (Stages.isLate(item, today)) return 'late';
  if (item.stage === 'to-buy' || item.stage === 'expected') return 'plain';
  if (item.stage === 'collected' || (Stages.isDone(item) && !Stages.isTracked(item))) return 'done';
  return item.stage === 'ready' ? 'near' : 'mid';
}

/** 'Promised 20/11/2026', 'Late: promised 10/11/2026', or ''. @param {Item} item @param {string} today */
export function promised(item, today) {
  if (!item.ready_by || Stages.isDone(item)) return '';
  return `${Stages.isLate(item, today) ? 'Late: promised' : 'Promised'} ${uk(item.ready_by)}`;
}

/** '3 families · 9 people'. @param {number} families @param {number} people */
export const familiesText = (families, people) => `${families} ${families === 1 ? 'family' : 'families'} · ${people} ${people === 1 ? 'person' : 'people'}`;

/** 'in 3 days', 'today', '2 days ago'. @param {number} days */
export const relDays = (days) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : days > 1 ? `in ${days} days` : days === -1 ? 'yesterday' : `${-days} days ago`);

/**
 * A box to add one thing at a time: type, press Enter (or Add), type the next. It stays open with the keyboard up; the
 * thing shows at once and is saved behind (ADR-013). A refusal (e.g. already in this city) is said, and the text kept.
 * @param {{ id: string, placeholder: string, label: string, add: (text: string) => { ok: boolean, errors?: Array<{ message: string }> } }} spec
 */
export function quickAdd(spec) {
  const box = /** @type {HTMLInputElement} */ (el('input', { id: spec.id, type: 'text', placeholder: spec.placeholder, 'aria-label': spec.label,
    autocomplete: 'off', enterkeyhint: 'enter', maxlength: 80, 'data-keep': '' }));
  return el('form', { class: 'quick-add', onsubmit: (/** @type {Event} */ ev) => {
    ev.preventDefault();
    const text = box.value.trim();
    if (!text) return;
    // Emptied first: adding redraws the screen, which carries over what the box holds and keeps it focused.
    box.value = '';
    const r = spec.add(text);
    if (!r.ok) {
      const now = /** @type {HTMLInputElement|null} */ (document.getElementById(spec.id));
      if (now) now.value = text;
      toastLater((r.errors ?? []).map((e) => e.message).join('; '));
    }
  } }, box, el('button', { class: 'button', type: 'submit' }, 'Add'));
}

/** Set by the screens' module that owns the toast (sheet.js), to avoid an import cycle. @type {(text: string) => void} */
let toastLater = () => { /* set below */ };
/** @param {(text: string) => void} fn */
export const useToast = (fn) => { toastLater = fn; };

/**
 * 'Saving…' under a row whose change is waiting, or 'Not saved' with Retry and Discard when its add was refused.
 * @param {null | 'saving' | { failed: string }} state @param {{ retry: () => void, discard: () => void }} actions
 */
export function saveState(state, actions) {
  if (!state) return '';
  if (state === 'saving') return el('span', { class: 'saving' }, 'Saving…');
  return el('span', { class: 'not-saved' }, `Not saved: ${state.failed} `,
    el('button', { class: 'link', type: 'button', onclick: (/** @type {Event} */ ev) => { ev.stopPropagation(); actions.retry(); } }, 'Retry'), ' · ',
    el('button', { class: 'link', type: 'button', onclick: (/** @type {Event} */ ev) => {
      ev.stopPropagation();
      if (window.confirm('Give up this entry? It leaves the phone.')) actions.discard();
    } }, 'Discard'));
}
