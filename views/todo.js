// @ts-check

import { el, today, uk } from '../dom.js';
import * as store from '../store/store.js';
import { Model } from '../shared/model.js';
import { empty, quickAdd, saveState } from './parts.js';
import { taskForm } from './forms.js';
import { toast } from './sheet.js';

/**
 * To do: open to-dos by kind (Decoration selection, Dresses to buy…), soonest first; done ones folded away at the end.
 * @param {HTMLElement} main
 */
export function todoScreen(main) {
  const now = today();
  const all = store.tasks();
  const open = all.filter((t) => !t.done);
  const done = all.filter((t) => t.done).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const byDue = (/** @type {Task} */ a, /** @type {Task} */ b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.title.localeCompare(b.title);
  const kinds = Model.orderNames(open.map((t) => t.category), Model.TASK_CATEGORIES);
  main.replaceChildren(
    el('div', { class: 'title-row' }, el('h1', { class: 'screen-title' }, 'To do'),
      el('button', { class: 'button', type: 'button', onclick: () => taskForm(null) }, '+ To-do')),
    all.length === 0 ? empty('Nothing yet: choosing the decoration, dresses to buy, booking the priest…') : '',
    ...kinds.flatMap((k) => [el('h2', { class: 'group-head' }, k),
      el('ul', { class: 'rows' }, open.filter((t) => t.category === k).sort(byDue).map((t) => row(t, now))),
      box(k)]),
    kinds.length ? '' : box('Other'),
    done.length ? el('details', { class: 'done-list' }, el('summary', {}, `Done (${done.length})`), el('ul', { class: 'rows' }, done.map((t) => row(t, now)))) : '');
}

/** A box adding to-dos of one kind. @param {string} kind */
const box = (kind) => quickAdd({ id: `add-task-${kind.replace(/[^A-Za-z0-9]/g, '-')}`, placeholder: `Add to ${kind}`, label: `Add a to-do to ${kind}`,
  add: (title) => store.queueAdd('task', { title, category: kind }) });

/** @param {Task} t @param {string} now */
function row(t, now) {
  const overdue = !t.done && t.due_date !== null && t.due_date < now;
  const sub = [t.owner ?? '', t.due_date ? `${overdue ? 'Overdue: was due' : 'By'} ${uk(t.due_date)}` : ''].filter(Boolean).join(' · ');
  return el('li', { class: `row${overdue ? ' is-late' : t.done ? ' is-done' : ''}` },
    el('button', { class: 'done-tick', type: 'button', 'aria-pressed': String(t.done), 'aria-label': `${t.done ? 'Done' : 'Not done'}: ${t.title}`,
      // Shown at once and saved behind (ADR-013).
      onclick: () => {
        store.markTask(t.task_id, !t.done);
        toast(t.done ? 'Back on the list.' : 'Done.', [], t.done ? undefined : () => store.markTask(t.task_id, false));
      } }, '✓'),
    el('button', { class: 'row-open', type: 'button', onclick: () => (t.version === 0 ? toast('Still saving: try again in a moment.') : taskForm(t.task_id)) },
      el('div', { class: `row-title${t.done ? ' done-title' : ''}` }, t.title),
      sub ? el('div', { class: `row-sub${overdue ? ' late' : ''}` }, sub) : '',
      t.note ? el('div', { class: 'row-sub' }, t.note) : '',
      saveState(store.rowState(t.task_id), { retry: () => store.retry(t.task_id), discard: () => store.discard(t.task_id) })));
}
