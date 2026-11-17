// @ts-check

import { el } from '../dom.js';

/**
 * Form fields for the app's sheets. Each returns the element and a way to read its value.
 */

/** @param {string} label @param {HTMLElement} control @param {string} [cls] */
export const field = (label, control, cls = '') => el('label', { class: `field ${cls}` }, el('span', {}, label), control);

/**
 * A field holding a group of buttons (e.g. the stage choices). Never a <label>: iPhone Safari treats a tap anywhere in a
 * label as a tap on the label's first button as well, so the button tapped was chosen and then the first one straight
 * after (RT, 2026-11-17: Received would not stick on an iPhone).
 * @param {string} label @param {HTMLElement} control @param {string} [cls]
 */
export const group = (label, control, cls = '') => el('div', { class: `field ${cls}`, role: 'group', 'aria-label': label }, el('span', {}, label), control);

/** @param {string} type @param {string|null} value @param {Record<string, unknown>} [attrs] */
export function input(type, value, attrs = {}) {
  const node = /** @type {HTMLInputElement} */ (el('input', { type, value: value ?? '', ...attrs }));
  return { node, get: () => node.value.trim() || null };
}

/**
 * Runs a save with its button disabled, so a second tap cannot send it twice.
 * @template T
 * @param {HTMLButtonElement} button
 * @param {() => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function busy(button, work) {
  button.disabled = true;
  try {
    return await work();
  } finally {
    button.disabled = false;
  }
}
