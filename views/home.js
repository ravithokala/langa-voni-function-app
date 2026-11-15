// @ts-check

import { el, today, uk } from '../dom.js';
import * as store from '../store/store.js';
import { meter, rupees, familiesText, relDays } from './parts.js';
import { settingsForm } from './forms.js';

/**
 * Home: days to go, then guests, budget, dresses and to-dos at a glance. Each card opens its tab.
 * @param {HTMLElement} main
 */
export function home(main) {
  const now = today();
  const s = store.summary(now);
  const g = s.guests;
  const b = s.budget;
  const dueSoon = [...s.tasks.overdue, ...s.tasks.soon].map((id) => store.data.tasks[id]).filter(Boolean);
  const late = s.dresses.late.map((id) => store.data.items[id]).filter(Boolean);

  const countdown = s.name ? el('section', { class: 'card countdown' },
    el('div', { class: 'days' }, s.daysToGo === null ? '—' : s.daysToGo > 0 ? String(s.daysToGo) : s.daysToGo === 0 ? 'Today!' : '✓'),
    el('div', { class: 'muted small' }, s.daysToGo === null ? 'Add the date in More' : s.daysToGo > 0 ? (s.daysToGo === 1 ? 'day to go' : 'days to go') : s.daysToGo < 0 ? `was ${relDays(s.daysToGo)}` : ''),
    el('div', { class: 'what' }, s.name),
    el('div', { class: 'when' }, [s.date ? uk(s.date) : '', s.venue ?? ''].filter(Boolean).join(' · ')))
    : el('section', { class: 'card countdown' },
      el('div', { class: 'what' }, 'Welcome'),
      el('p', { class: 'muted small' }, 'Start with the function’s name and date.'),
      el('button', { class: 'button primary', type: 'button', onclick: () => settingsForm() }, 'Set up the function'));

  main.replaceChildren(
    countdown,
    el('a', { class: 'card card-link', href: '#/guests' },
      el('div', { class: 'card-top' }, el('h2', {}, 'Guests'), el('span', { class: 'count' }, familiesText(g.families, g.people))),
      g.families === 0 ? el('p', { class: 'muted small' }, 'No families yet: add cities and families in Guests.') : [
        el('div', { class: 'stats' },
          el('div', { class: 'stat' }, el('b', {}, `${g.informed} of ${g.families}`), el('span', {}, `informed · ${g.informedPeople} people`)),
          el('div', { class: 'stat' }, el('b', {}, `${g.invited} of ${g.families}`), el('span', {}, `invited · ${g.invitedPeople} people`))),
        meter(g.invited, g.families, 'Families invited')]),
    el('a', { class: 'card card-link', href: '#/budget' },
      el('div', { class: 'card-top' }, el('h2', {}, 'Budget'), el('span', { class: 'count' }, `${b.lines} ${b.lines === 1 ? 'line' : 'lines'}`)),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('b', {}, rupees(b.total)), el('span', {}, 'total')),
        el('div', { class: 'stat' }, el('b', {}, rupees(b.advance)), el('span', {}, 'advance given')),
        el('div', { class: 'stat' }, el('b', {}, rupees(b.balance)), el('span', {}, 'balance to pay')),
        b.unpriced ? el('div', { class: 'stat' }, el('b', {}, String(b.unpriced)), el('span', {}, 'without a price yet')) : '')),
    el('a', { class: 'card card-link', href: '#/shopping/dresses' },
      el('div', { class: 'card-top' }, el('h2', {}, 'Dresses'),
        el('span', { class: 'count' }, s.dresses.total ? `${s.dresses.total - s.dresses.notReady} of ${s.dresses.total} ready` : 'none yet')),
      s.dresses.total ? meter(s.dresses.total - s.dresses.notReady, s.dresses.total, 'Dresses ready') : '',
      late.length ? el('ul', { class: 'list-plain' }, late.map((d) => el('li', {}, el('span', {}, d.name),
        el('span', { class: 'pill late' }, `Late · ${uk(d.ready_by)}`)))) : ''),
    el('a', { class: 'card card-link', href: '#/todo' },
      el('div', { class: 'card-top' }, el('h2', {}, 'To do'), el('span', { class: 'count' }, `${s.tasks.open} open`)),
      dueSoon.length ? el('ul', { class: 'list-plain' }, dueSoon.map((t) => el('li', {}, el('span', {}, t.title),
        el('span', { class: `pill ${t.due_date && t.due_date < now ? 'late' : 'mid'}` }, t.due_date && t.due_date < now ? `Overdue · ${uk(t.due_date)}` : uk(t.due_date)))))
        : el('p', { class: 'muted small' }, s.tasks.open ? 'Nothing due this week.' : 'Nothing to do yet.')));
}
