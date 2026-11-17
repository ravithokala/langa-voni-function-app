// @ts-check

import { el, today } from '../dom.js';
import * as store from '../store/store.js';
import { Stages } from '../shared/stages.js';
import { Money } from '../shared/money.js';
import { Weight } from '../shared/weight.js';
import { empty, rupees, stageClass, promised, quickAdd, saveState } from './parts.js';
import { itemForm } from './forms.js';
import { toast } from './sheet.js';

/**
 * Shopping: Dresses, Jewellery and Other (ADR-008, ADR-014). Each item shows its price, advance and balance, and where it is: tap the stage
 * to move it one step on (Undo puts it back). A dress or piece of jewellery past its promised-by date and not ready is
 * marked Late.
 * @param {HTMLElement} main @param {string} arg  dresses, jewellery or other
 */
export function shoppingScreen(main, arg) {
  const section = /** @type {ItemSection} */ (arg === 'other' || arg === 'jewellery' ? arg : 'dresses');
  const words = WORDS[section];
  const now = today();
  const list = store.items(section);
  const tab = (/** @type {ItemSection} */ id, /** @type {string} */ label) => el('button', { type: 'button', 'aria-pressed': String(id === section),
    onclick: () => { window.location.hash = `#/shopping/${id}`; } }, label);
  // Money spent only: a gift's value is not counted (ADR-015), as in the budget.
  const paid = list.filter((i) => !Stages.isGift(i));
  const total = paid.reduce((sum, i) => sum + (i.total_paise ?? 0), 0);
  const advance = paid.reduce((sum, i) => sum + (i.advance_paise ?? 0), 0);
  const notDone = list.filter((i) => !Stages.isDone(i)).length;
  // Gold and silver totalled apart (ADR-017).
  const grams = Weight.formatByMetal(Weight.byMetal(list.filter((i) => i.section === 'jewellery')));

  main.replaceChildren(
    el('div', { class: 'title-row' }, el('h1', { class: 'screen-title' }, 'Shopping'),
      el('button', { class: 'button', type: 'button', onclick: () => itemForm(null, section) }, words.button)),
    el('div', { class: 'segmented wide', role: 'group', 'aria-label': 'Section' }, tab('dresses', 'Dresses'), tab('jewellery', 'Jewellery'), tab('other', 'Other')),
    list.length ? el('p', { class: 'totals-bar' },
      el('span', {}, el('b', {}, String(list.length)), ` ${words.plural} · ${notDone} ${section === 'other' ? 'to buy' : section === 'jewellery' ? 'not ready or received' : 'not ready'}`),
      grams ? el('span', {}, el('b', {}, grams)) : '',
      el('span', {}, 'Total ', el('b', {}, Money.format(total))),
      el('span', {}, 'Balance ', el('b', {}, Money.format(total - advance)))) : '',
    list.length ? el('ul', { class: 'rows' }, list.map((i) => row(i, now)))
      : empty(words.empty),
    quickAdd({ id: `add-item-${section}`, placeholder: words.add, label: words.add,
      add: (name) => store.queueAdd('item', { section, name }) }),
    el('p', { class: 'hint' }, words.hint));
}

/** Each section's wording. */
const WORDS = {
  dresses: { button: '+ Dress', plural: 'dresses', add: 'Add a dress', hint: 'Tap a dress to add its price, shop, tailor and dates.', empty: 'No dresses yet. Add each dress to follow it from buying to stitching to ready.' },
  jewellery: { button: '+ Piece', plural: 'pieces', add: 'Add a piece of jewellery', hint: 'Tap a piece to add its weight, price, jeweller and dates, or who gave it.', empty: 'No jewellery yet. Add each piece to follow it from ordering to ready.' },
  other: { button: '+ Item', plural: 'items', add: 'Add something to buy', hint: 'Tap an entry to add its price and shop.', empty: 'Nothing yet: return gifts, pooja things, decorations…' },
};

/** @param {Item} i @param {string} now */
function row(i, now) {
  const late = Stages.isLate(i, now);
  const next = Stages.next(i, i.stage);
  const who = [i.for_whom ? `for ${i.for_whom}` : '', i.gifted_by ? `${i.section === 'jewellery' ? 'gift from' : 'brought by'} ${i.gifted_by}` : '', i.section === 'dresses' ? i.tailor ?? i.vendor : i.vendor,
    i.weight_mg !== null ? Weight.formatPiece(i.weight_mg, i.metal) : i.section === 'jewellery' && i.metal === 'silver' ? 'silver' : ''].filter(Boolean).join(' · ');
  const when = promised(i, now);
  const given = i.section === 'jewellery' ? 'A gift' : 'Brought by others';
  const money = Stages.isGift(i) ? (i.total_paise === null ? given : `${given} · worth ${rupees(i.total_paise)}`)
    : i.total_paise === null && i.advance_paise === null ? 'No price yet'
    : `${rupees(i.total_paise)} · advance ${rupees(i.advance_paise)} · balance ${rupees(Money.balance(i.total_paise, i.advance_paise))}`;
  return el('li', { class: `row${late ? ' is-late' : Stages.isDone(i) ? ' is-done' : ''}` },
    el('div', { class: 'row-body' },
      el('button', { class: 'row-open', type: 'button', onclick: () => (i.version === 0 ? toast('Still saving: try again in a moment.') : itemForm(i.item_id)) },
        el('div', { class: 'row-title' }, i.name),
        who ? el('div', { class: 'row-sub' }, who) : '',
        when ? el('div', { class: `row-sub${late ? ' late' : ''}` }, when) : '',
        el('div', { class: 'money' }, money)),
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
