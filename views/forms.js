// @ts-check

import { el } from '../dom.js';
import * as store from '../store/store.js';
import { Money } from '../shared/money.js';
import { Stages } from '../shared/stages.js';
import { openSheet, toast } from './sheet.js';
import { field, busy } from './fields.js';

/**
 * The forms that add, change and remove things. One builder; each opening function lists its fields.
 *
 * @typedef {Object} Spec
 * @property {string} key                  the field the server knows it by
 * @property {string} label
 * @property {'text'|'number'|'money'|'date'|'textarea'|'stage'|'select'} type
 * @property {unknown} value
 * @property {string[]} [suggestions]      offered as you type (text)
 * @property {Array<[string, string]>} [options]  value, label (select)
 * @property {ItemSection} [section]       for a stage picker
 * @property {boolean} [half]              shown two to a row
 * @property {string} [hint]
 *
 * @typedef {Object} FormSpec
 * @property {string} title
 * @property {Spec[]} fields
 * @property {(values: Record<string, unknown>) => Promise<import('../store/store.js').SaveResult>} save
 * @property {() => Promise<import('../store/store.js').SaveResult>} [remove]
 * @property {string} [removeAsk]
 * @property {string} [saved]
 */

let lists = 0;

/** @param {Spec} spec @returns {{ node: HTMLElement, get: () => unknown }} */
function control(spec) {
  const id = `f-${spec.key}`;
  if (spec.type === 'textarea') {
    const node = /** @type {HTMLTextAreaElement} */ (el('textarea', { id, rows: 3, maxlength: 300 }));
    node.value = /** @type {string} */ (spec.value ?? '');
    return { node, get: () => node.value };
  }
  if (spec.type === 'select') {
    const node = /** @type {HTMLSelectElement} */ (el('select', { id }, (spec.options ?? []).map(([v, label]) => el('option', { value: v, selected: v === spec.value }, label))));
    return { node, get: () => node.value };
  }
  if (spec.type === 'stage') {
    let chosen = /** @type {Stage} */ (spec.value ?? 'to-buy');
    const node = el('div', { class: 'stage-steps', role: 'group', 'aria-label': spec.label });
    const draw = () => node.replaceChildren(...Stages.forSection(spec.section).map((s) => el('button', { type: 'button', 'aria-pressed': String(s.id === chosen),
      onclick: () => { chosen = s.id; draw(); } }, s.label)));
    draw();
    return { node, get: () => chosen };
  }
  const attrs = /** @type {Record<string, unknown>} */ ({ id, autocomplete: 'off' });
  let value = /** @type {string} */ (spec.value ?? '');
  if (spec.type === 'money') Object.assign(attrs, { type: 'text', inputmode: 'decimal', placeholder: '₹' });
  else if (spec.type === 'number') Object.assign(attrs, { type: 'number', inputmode: 'numeric', min: 1, max: 200 });
  else if (spec.type === 'date') attrs.type = 'date';
  else Object.assign(attrs, { type: 'text', maxlength: 80 });
  if (spec.type === 'money') value = Money.toInput(/** @type {number|null} */ (spec.value));
  if (spec.type === 'number') value = spec.value === null || spec.value === undefined ? '' : String(spec.value);
  let datalist = null;
  if (spec.suggestions?.length) {
    attrs.list = `list-${++lists}`;
    datalist = el('datalist', { id: attrs.list }, spec.suggestions.map((s) => el('option', { value: s })));
  }
  const node = /** @type {HTMLInputElement} */ (el('input', attrs));
  node.value = value;
  return { node: datalist ? el('span', { class: 'with-list' }, node, datalist) : node, get: () => node.value };
}

/** @param {FormSpec} spec */
function openForm(spec) {
  const controls = spec.fields.map((f) => ({ spec: f, ...control(f) }));
  const labelOf = (/** @type {string} */ key) => spec.fields.find((f) => f.key === key)?.label ?? '';
  const save = /** @type {HTMLButtonElement} */ (el('button', { class: 'primary', type: 'button' }, 'Save'));
  /** @type {HTMLElement[]} */
  const rows = [];
  for (let i = 0; i < controls.length; i++) {
    const c = controls[i];
    const one = (/** @type {typeof c} */ x) => field(x.spec.label, x.node, x.spec.type === 'stage' ? 'stage-field' : '');
    if (c.spec.half && controls[i + 1]?.spec.half) { rows.push(el('div', { class: 'row2' }, one(c), one(controls[i + 1]))); i += 1; } else rows.push(one(c));
    if (c.spec.hint) rows.push(el('p', { class: 'hint' }, c.spec.hint));
  }
  /** @param {Issue[]} errors */
  const show = (errors) => sheet.messages.replaceChildren(...errors.map((e) => el('div', { class: 'msg error' },
    labelOf(e.field) ? `${labelOf(e.field)}: ${e.message}` : e.message)));
  const sheet = openSheet(spec.title, el('div', { class: 'form' }, rows,
    el('div', { class: 'actions' },
      spec.remove ? el('button', { class: 'danger', type: 'button', onclick: async (/** @type {Event} */ ev) => {
        if (!window.confirm(spec.removeAsk ?? 'Remove this?')) return;
        const r = await busy(/** @type {HTMLButtonElement} */ (ev.currentTarget), /** @type {() => Promise<any>} */ (spec.remove));
        if (r.ok) { sheet.close(); toast('Removed.'); } else show(r.errors);
      } }, 'Remove') : '',
      save)));
  save.addEventListener('click', async () => {
    const values = Object.fromEntries(controls.map((c) => [c.spec.key, c.get()]));
    const r = await busy(save, () => spec.save(values));
    if (r.ok) { sheet.close(); toast(spec.saved ?? 'Saved.'); } else show(r.errors);
  });
  const first = controls[0]?.node;
  (first?.querySelector?.('input') ?? first)?.focus?.();
}

/** The function's name, date, venue and note. */
export function settingsForm() {
  const f = store.fn();
  openForm({
    title: f ? 'The function' : 'Set up the function',
    fields: [
      { key: 'name', label: 'Name', type: 'text', value: f?.name ?? 'Langa Voni' },
      { key: 'date', label: 'Date', type: 'date', value: f?.date ?? '' },
      { key: 'venue', label: 'Venue', type: 'text', value: f?.venue ?? '' },
      { key: 'note', label: 'Note', type: 'textarea', value: f?.note ?? '' },
    ],
    save: (v) => store.saveSettings(v),
  });
}

/** @param {string|null} [id] */
export function cityForm(id = null) {
  const c = id ? store.data.cities[id] : null;
  openForm({
    title: c ? 'Change city' : 'Add a city',
    fields: [{ key: 'name', label: 'City', type: 'text', value: c?.name ?? '' }],
    save: (v) => store.save('city', id, v),
    remove: c ? () => store.remove('city', c.city_id) : undefined,
    removeAsk: c ? `Remove ${c.name}? Only a city with no families can be removed.` : undefined,
    saved: c ? 'Saved.' : 'City added.',
  });
}

/** @param {string|null} id  a family to change; none adds one @param {string} [cityId]  where a new one goes */
export function guestForm(id, cityId) {
  const g = id ? store.data.guests[id] : null;
  const cities = store.cities();
  openForm({
    title: g ? 'Change family' : 'Add a family',
    fields: [
      { key: 'name', label: 'Family', type: 'text', value: g?.name ?? '' },
      { key: 'headcount', label: 'People', type: 'number', value: g?.headcount ?? 1, half: true },
      { key: 'city_id', label: 'City', type: 'select', value: g?.city_id ?? cityId ?? cities[0]?.city_id, options: cities.map((c) => [c.city_id, c.name]), half: true },
      { key: 'note', label: 'Note', type: 'textarea', value: g?.note ?? '' },
    ],
    save: (v) => store.save('guest', id, { ...v, informed: g?.informed ?? false, invited: g?.invited ?? false }),
    remove: g ? () => store.remove('guest', g.guest_id) : undefined,
    removeAsk: g ? `Remove ${g.name} from the list?` : undefined,
    saved: g ? 'Saved.' : 'Family added.',
  });
}

/** @param {string|null} id @param {ItemSection} [section] */
export function itemForm(id, section = 'dresses') {
  const i = id ? store.data.items[id] : null;
  const s = i?.section ?? section;
  const dress = s === 'dresses';
  /** @type {Spec[]} */
  const fields = [
    { key: 'name', label: dress ? 'Dress' : 'Item', type: 'text', value: i?.name ?? '' },
    { key: 'for_whom', label: 'For', type: 'text', value: i?.for_whom ?? '', half: true },
    { key: 'vendor', label: 'Shop', type: 'text', value: i?.vendor ?? '', half: true },
    { key: 'total_paise', label: 'Total price', type: 'money', value: i?.total_paise ?? null, half: true },
    { key: 'advance_paise', label: 'Advance given', type: 'money', value: i?.advance_paise ?? null, half: true },
    { key: 'stage', label: 'Where it is', type: 'stage', value: i?.stage ?? 'to-buy', section: s },
  ];
  if (dress) {
    fields.push({ key: 'tailor', label: 'Tailor', type: 'text', value: i?.tailor ?? '' },
      { key: 'given_on', label: 'Given on', type: 'date', value: i?.given_on ?? '', half: true },
      { key: 'ready_by', label: 'Promised by', type: 'date', value: i?.ready_by ?? '', half: true });
  }
  fields.push({ key: 'note', label: 'Note', type: 'textarea', value: i?.note ?? '' });
  openForm({
    title: i ? `Change ${dress ? 'dress' : 'item'}` : dress ? 'Add a dress' : 'Add something to buy',
    fields,
    save: (v) => store.save('item', id, { ...v, section: s }),
    remove: i ? () => store.remove('item', i.item_id) : undefined,
    removeAsk: i ? `Remove ${i.name}? It leaves the budget too.` : undefined,
    saved: i ? 'Saved.' : 'Added.',
  });
}

/** @param {string|null} id @param {string} [section] */
export function lineForm(id, section = '') {
  const l = id ? store.data.budget[id] : null;
  openForm({
    title: l ? 'Change budget line' : 'Add to the budget',
    fields: [
      { key: 'section', label: 'Section', type: 'text', value: l?.section ?? section, suggestions: store.budgetSections() },
      { key: 'name', label: 'What', type: 'text', value: l?.name ?? '' },
      { key: 'total_paise', label: 'Total price', type: 'money', value: l?.total_paise ?? null, half: true },
      { key: 'advance_paise', label: 'Advance given', type: 'money', value: l?.advance_paise ?? null, half: true },
      { key: 'due_date', label: 'Balance due by', type: 'date', value: l?.due_date ?? '' },
      { key: 'note', label: 'Note', type: 'textarea', value: l?.note ?? '' },
    ],
    save: (v) => store.save('line', id, v),
    remove: l ? () => store.remove('line', l.line_id) : undefined,
    removeAsk: l ? `Remove ${l.name} from the budget?` : undefined,
    saved: l ? 'Saved.' : 'Added to the budget.',
  });
}

/** @param {string|null} id @param {string} [category] */
export function taskForm(id, category = '') {
  const t = id ? store.data.tasks[id] : null;
  openForm({
    title: t ? 'Change to-do' : 'Add a to-do',
    fields: [
      { key: 'title', label: 'To do', type: 'text', value: t?.title ?? '' },
      { key: 'category', label: 'Kind', type: 'text', value: t?.category ?? category, suggestions: store.taskCategories() },
      { key: 'owner', label: 'Who', type: 'text', value: t?.owner ?? '', suggestions: store.status.users, half: true },
      { key: 'due_date', label: 'By', type: 'date', value: t?.due_date ?? '', half: true },
      { key: 'note', label: 'Note', type: 'textarea', value: t?.note ?? '' },
    ],
    save: (v) => store.save('task', id, { ...v, done: t?.done ?? false }),
    remove: t ? () => store.remove('task', t.task_id) : undefined,
    removeAsk: t ? `Remove "${t.title}"?` : undefined,
    saved: t ? 'Saved.' : 'To-do added.',
  });
}
