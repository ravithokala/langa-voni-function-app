// @ts-check

import { el } from '../dom.js';
import * as store from '../store/store.js';
import { Guests } from '../shared/guests.js';
import { empty, familiesText, quickAdd, saveState } from './parts.js';
import { cityForm, guestForm } from './forms.js';
import { toast } from './sheet.js';

/**
 * Guests: families under their city (ADR-006). Each family has Informed and Invited, one tap each. The link at the
 * top changes the order within every city (Not informed first → Not invited first → A–Z); search narrows the list.
 */

let search = '';
/** Cities folded shut, kept while the app is open. */
const folded = new Set();

/** @param {HTMLElement} main */
export function guestsScreen(main) {
  const hadFocus = document.activeElement?.id === 'guest-search';
  const caret = hadFocus ? /** @type {HTMLInputElement} */ (document.activeElement).selectionStart : null;
  const order = store.guestOrder();
  const t = store.guestTotals();
  const list = el('div', {});
  const box = /** @type {HTMLInputElement} */ (el('input', { id: 'guest-search', type: 'search', placeholder: 'Search families or cities', 'aria-label': 'Search', autocomplete: 'off' }));
  box.value = search;
  box.addEventListener('input', () => { search = box.value; drawList(list, order); });

  main.replaceChildren(
    el('div', { class: 'title-row' }, el('h1', { class: 'screen-title' }, 'Guests'),
      el('button', { class: 'button', type: 'button', onclick: () => cityForm() }, '+ City')),
    el('p', { class: 'totals-bar' },
      el('span', {}, el('b', {}, familiesText(t.families, t.people))),
      el('span', {}, 'Informed ', el('b', {}, `${t.informed}`), ` (${t.informedPeople})`),
      el('span', {}, 'Invited ', el('b', {}, `${t.invited}`), ` (${t.invitedPeople})`)),
    el('div', { class: 'guest-tools' }, box,
      el('button', { class: 'order-link', type: 'button', title: 'Change the order',
        onclick: () => store.setGuestOrder(Guests.nextOrder(order)) }, `Order: ${Guests.orderLabel(order)} ↻`)),
    list);
  drawList(list, order);
  if (hadFocus) { box.focus(); if (caret !== null) box.setSelectionRange(caret, caret); }
}

/** @param {HTMLElement} list @param {GuestOrder} order */
function drawList(list, order) {
  const groups = store.guestGroups({ order, search });
  if (store.cities().length === 0) {
    list.replaceChildren(empty('No cities yet. Add a city (e.g. Hyderabad), then the families invited from there.'),
      el('button', { class: 'button primary', type: 'button', onclick: () => cityForm() }, 'Add the first city'));
    return;
  }
  list.replaceChildren(...(groups.length === 0 ? [empty('Nothing matches.')] : groups.map((g) => city(g))));
}

/** @param {CityGroup} g */
function city(g) {
  const c = g.counts;
  const open = search !== '' || !folded.has(g.city.city_id);
  const details = /** @type {HTMLDetailsElement} */ (el('details', { class: 'city', open },
    el('summary', {},
      el('span', { class: 'city-name' }, g.city.name),
      el('span', { class: 'city-counts' }, familiesText(c.families, c.people), el('br'), `${c.informed} informed · ${c.invited} invited`),
      el('button', { class: 'city-edit', type: 'button', 'aria-label': `Change ${g.city.name}`,
        onclick: (/** @type {Event} */ ev) => { ev.preventDefault(); cityForm(g.city.city_id); } }, 'Edit')),
    g.guests.length ? el('ul', { class: 'families' }, g.guests.map(family)) : el('p', { class: 'muted small city-add' }, 'No families here yet.'),
    el('div', { class: 'city-add' }, quickAdd({ id: `add-family-${g.city.city_id}`, placeholder: 'Add a family', label: `Add a family in ${g.city.name}`,
      add: (name) => store.queueAdd('guest', { city_id: g.city.city_id, name, headcount: 1 }) }))));
  details.addEventListener('toggle', () => { if (search === '') { if (details.open) folded.delete(g.city.city_id); else folded.add(g.city.city_id); } });
  return details;
}

/** @param {Guest} g */
function family(g) {
  const state = store.rowState(g.guest_id);
  /** @param {'informed'|'invited'} field @param {string} label */
  const tick = (field, label) => el('button', { class: 'tickbox', type: 'button', 'aria-pressed': String(g[field]), 'aria-label': `${label}: ${g.name}`,
    // Shown at once and saved behind (ADR-013): quick taps never wait for the server.
    onclick: () => store.markGuest(g.guest_id, field, !g[field]) }, el('i', { 'aria-hidden': 'true' }, g[field] ? '✓' : ''), label);
  return el('li', { class: 'family' },
    el('button', { class: 'family-name', type: 'button', onclick: () => (g.version === 0 ? toast('Still saving: try again in a moment.') : guestForm(g.guest_id)) },
      el('b', {}, g.name), el('span', {}, `${g.headcount} ${g.headcount === 1 ? 'person' : 'people'}${g.note ? ` · ${g.note}` : ''}`),
      saveState(state, { retry: () => store.retry(g.guest_id), discard: () => store.discard(g.guest_id) })),
    tick('informed', 'Informed'), tick('invited', 'Invited'));
}
