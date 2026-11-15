// @ts-check

import { el, today, uk } from '../dom.js';
import * as store from '../store/store.js';
import { empty, rupees } from './parts.js';
import { Weight } from '../shared/weight.js';
import { itemForm, lineForm } from './forms.js';

/**
 * Budget (ADR-008, ADR-015): the grand total, then Shopping, Jewellery and Gifted jewellery (straight from the Shopping
 * tab; gifts are listed with who gave them and their weight, not counted in the totals) and each section. Every line has
 * its total, advance given and balance.
 * @param {HTMLElement} main
 */
export function budgetScreen(main) {
  const { sections, totals } = store.budget();
  const now = today();
  main.replaceChildren(
    el('div', { class: 'title-row' }, el('h1', { class: 'screen-title' }, 'Budget'),
      el('button', { class: 'button', type: 'button', onclick: () => lineForm(null) }, '+ Add')),
    el('section', { class: 'card grand' },
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('b', {}, rupees(totals.total)), el('span', {}, 'total')),
        el('div', { class: 'stat' }, el('b', {}, rupees(totals.advance)), el('span', {}, 'advance given')),
        el('div', { class: 'stat' }, el('b', {}, rupees(totals.balance)), el('span', {}, 'balance to pay')),
        el('div', { class: 'stat' }, el('b', {}, String(totals.lines)), el('span', {}, totals.unpriced ? `lines · ${totals.unpriced} without a price` : 'lines')))),
    ...sections.map((s) => card(s, now)),
    sections.length === 1 && sections[0].rows.length === 0 ? empty('Add the venue, catering, decoration and the rest with + Add. Shopping appears here by itself.') : '');
}

/** Gifted jewellery: who gave each piece and its weight; its value for reference, not in the totals. @param {BudgetSection} s */
function giftsCard(s) {
  return el('section', { class: 'card' },
    el('div', { class: 'card-top' }, el('h2', {}, s.name), el('span', { class: 'count num' }, [s.grams ? Weight.format(s.grams) : '', `${s.rows.length} ${s.rows.length === 1 ? 'piece' : 'pieces'}`].filter(Boolean).join(' · '))),
    el('p', { class: 'link-note' }, 'Gifts: not counted in the totals. From the Shopping tab: change these there.'),
    el('table', { class: 'budget-table' },
      el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Weight'), el('th', {}, 'Value'))),
      el('tbody', {}, s.rows.map((r) => el('tr', {},
        el('td', {}, el('button', { type: 'button', onclick: () => itemForm(r.id) }, r.name,
          el('span', { class: 'vendor' }, [r.gifted_by ? `from ${r.gifted_by}` : '', r.for_whom ? `for ${r.for_whom}` : ''].filter(Boolean).join(' · ')))),
        el('td', {}, r.weight_mg !== null ? Weight.format(r.weight_mg) : '—'), el('td', {}, rupees(r.total_paise)))),
      el('tr', { class: 'sum' }, el('td', {}, 'Section'), el('td', {}, s.grams ? Weight.format(s.grams) : '—'), el('td', {}, rupees(s.totals.total))))));
}

/** @param {BudgetSection} s @param {string} now */
function card(s, now) {
  if (s.linked && s.rows.length === 0) return '';
  if (s.gifts) return giftsCard(s);
  return el('section', { class: 'card' },
    el('div', { class: 'card-top' }, el('h2', {}, s.name), el('span', { class: 'count num' }, [s.grams ? Weight.format(s.grams) : '', rupees(s.totals.total)].filter(Boolean).join(' · '))),
    s.linked ? el('p', { class: 'link-note' }, 'From the Shopping tab: change these there.') : '',
    el('table', { class: 'budget-table' },
      el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Total'), el('th', {}, 'Advance'), el('th', {}, 'Balance'))),
      el('tbody', {}, s.rows.map((r) => {
        const overdue = r.due_date && r.due_date < now && (r.balance_paise ?? 0) > 0;
        // Under the name: who a shopping item is for (RT, 2026-11-15); a budget line's due date (who to pay is not asked for).
        const vendor = [r.for_whom ? `for ${r.for_whom}` : '', r.weight_mg !== null ? Weight.format(r.weight_mg) : ''].filter(Boolean).join(' · ') || null;
        return el('tr', {},
          el('td', {}, el('button', { type: 'button', onclick: () => (r.kind === 'item' ? itemForm(r.id) : lineForm(r.id)) }, r.name,
            vendor || r.due_date ? el('span', { class: `vendor${overdue ? ' error' : ''}` },
              [vendor ?? '', r.due_date ? `${overdue ? 'overdue' : 'due'} ${uk(r.due_date)}` : ''].filter(Boolean).join(' · ')) : '')),
          el('td', {}, rupees(r.total_paise)), el('td', {}, rupees(r.advance_paise)), el('td', {}, rupees(r.balance_paise)));
      }),
      el('tr', { class: 'sum' }, el('td', {}, 'Section'), el('td', {}, rupees(s.totals.total)), el('td', {}, rupees(s.totals.advance)), el('td', {}, rupees(s.totals.balance))))),
    s.linked ? '' : el('button', { class: 'link', type: 'button', onclick: () => lineForm(null, s.name) }, `+ Add to ${s.name}`));
}
