// @ts-check

import { el, today } from '../dom.js';
import * as store from '../store/store.js';
import { Stages } from '../shared/stages.js';
import { Money } from '../shared/money.js';
import { empty, rupees, stageClass, promised, quickAdd, saveState } from './parts.js';
import { itemForm } from './forms.js';
import { toast } from './sheet.js';

/**
 * Shopping: Dresses and Other (ADR-008). Each item shows its price, advance and balance, and where it is: tap the stage
 * to move it one step on (Undo puts it back). A dress past its promised-by date and not ready is marked Late.
 * @param {HTMLElement} main @param {string} arg  dresses or other
 */
export function shoppingScreen(main, arg) {
  const section = /** @type {ItemSection} */ (arg === 'other' ? 'other' : 'dresses');
  const now = today();
  const list = store.items(section);
  const tab = (/** @type {ItemSection} */ id, /** @type {string} */ label) => el('button', { type: 'button', 'aria-pressed': String(id === section),
    onclick: () => { window.location.hash = `#/shopping/${id}`; } }, label);
  const total = list.reduce((sum, i) => sum + (i.total_paise ?? 0), 0);
  const advance = list.reduce((sum, i) => sum + (i.advance_paise ?? 0), 0);
  const notDone = list.filter((i) => !Stages.isDone(i)).length;

  main.replaceChildren(
    el('div', { class: 'title-row' }, el('h1', { class: 'screen-title' }, 'Shopping'),
      el('button', { class: 'button', type: 'button', onclick: () => itemForm(null, section) }, section === 'dresses' ? '+ Dress' : '+ Item')),
    el('div', { class: 'segmented wide', role: 'group', 'aria-label': 'Section' }, tab('dresses', 'Dresses'), tab('other', 'Other')),
    list.length ? el('p', { class: 'totals-bar' },
      el('span', {}, el('b', {}, String(list.length)), section === 'dresses' ? ` dresses · ${notDone} not ready` : ` items · ${notDone} to buy`),
      el('span', {}, 'Total ', el('b', {}, Money.format(total))),
      el('span', {}, 'Balance ', el('b', {}, Money.format(total - advance)))) : '',
    list.length ? el('ul', { class: 'rows' }, list.map((i) => row(i, now)))
      : empty(section === 'dresses' ? 'No dresses yet. Add each dress to follow it from buying to stitching to ready.' : 'Nothing yet: jewellery, return gifts, pooja things…'),
    quickAdd({ id: `add-item-${section}`, placeholder: section === 'dresses' ? 'Add a dress' : 'Add something to buy', label: section === 'dresses' ? 'Add a dress' : 'Add something to buy',
      add: (name) => store.queueAdd('item', { section, name }) }),
    el('p', { class: 'hint' }, 'Tap an entry to add its price, shop or tailor.'));
}

/** @param {Item} i @param {string} now */
function row(i, now) {
  const late = Stages.isLate(i, now);
  const next = Stages.next(i.section, i.stage);
  const who = [i.for_whom ? `for ${i.for_whom}` : '', i.section === 'dresses' ? i.tailor ?? i.vendor : i.vendor].filter(Boolean).join(' · ');
  const when = promised(i, now);
  const money = i.total_paise === null && i.advance_paise === null ? 'No price yet'
    : `${rupees(i.total_paise)} · advance ${rupees(i.advance_paise)} · balance ${rupees(Money.balance(i.total_paise, i.advance_paise))}`;
  return el('li', { class: `row${late ? ' is-late' : Stages.isDone(i) ? ' is-done' : ''}` },
    el('button', { class: 'row-open', type: 'button', onclick: () => (i.version === 0 ? toast('Still saving: try again in a moment.') : itemForm(i.item_id)) },
      el('div', { class: 'row-title' }, i.name),
      who ? el('div', { class: 'row-sub' }, who) : '',
      when ? el('div', { class: `row-sub${late ? ' late' : ''}` }, when) : '',
      el('div', { class: 'money' }, money),
      saveState(store.rowState(i.item_id), { retry: () => store.retry(i.item_id), discard: () => store.discard(i.item_id) })),
    el('button', { class: `pill ${stageClass(i, now)}`, type: 'button', disabled: !next,
      'aria-label': next ? `${Stages.label(i.stage)}: tap for ${Stages.label(next)}` : Stages.label(i.stage),
      // Shown at once and saved behind (ADR-013); Undo puts the stage back the same way.
      onclick: () => {
        if (!next) return;
        const before = i.stage;
        store.setStage(i.item_id, next);
        toast(`${i.name}: ${Stages.label(next)}.`, [], () => store.setStage(i.item_id, before));
      } }, Stages.label(i.stage)));
}
