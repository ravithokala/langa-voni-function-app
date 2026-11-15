// @ts-check
// GENERATED from apps-script/domain/dashboard.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.
import { Dates } from './dates.js';
import { Model } from './model.js';
import { Stages } from './stages.js';
import { Guests } from './guests.js';
import { Budget } from './budget.js';

/**
 * The Home screen's figures: days to go, guests informed and invited, the budget, dresses not
 * ready, and to-dos overdue or due within a week.
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Dashboard = (() => {
  const SOON_DAYS = 7;

  /**
   * @param {{ settings: ReadonlyArray<Settings>, cities: ReadonlyArray<City>, guests: ReadonlyArray<Guest>, items: ReadonlyArray<Item>,
   *   budget: ReadonlyArray<BudgetLine>, tasks: ReadonlyArray<Task> }} data
   * @param {string} today
   * @returns {DashboardSummary}
   */
  function summary(data, today) {
    const fn = data.settings.find((s) => s.function_id === Model.FUNCTION_ID && !s.deleted) ?? null;
    const liveCities = new Set(data.cities.filter((c) => !c.deleted).map((c) => c.city_id));
    const dresses = data.items.filter((i) => !i.deleted && i.section === 'dresses');
    const open = data.tasks.filter((t) => !t.deleted && !t.done);
    const byDue = (/** @type {Task} */ a, /** @type {Task} */ b) => String(a.due_date).localeCompare(String(b.due_date));
    return {
      name: fn ? fn.name : null,
      date: fn ? fn.date : null,
      venue: fn ? fn.venue : null,
      daysToGo: fn && fn.date ? Dates.daysBetween(today, fn.date) : null,
      guests: Guests.counts(data.guests.filter((g) => liveCities.has(g.city_id))),
      budget: Budget.build(data.items, data.budget).totals,
      dresses: { total: dresses.length, notReady: dresses.filter((d) => !Stages.isDone(d)).length,
        late: dresses.filter((d) => Stages.isLate(d, today)).map((d) => d.item_id) },
      tasks: {
        open: open.length,
        overdue: open.filter((t) => t.due_date !== null && t.due_date < today).sort(byDue).map((t) => t.task_id),
        soon: open.filter((t) => t.due_date !== null && t.due_date >= today && Dates.daysBetween(today, t.due_date) <= SOON_DAYS)
          .sort(byDue).map((t) => t.task_id),
      },
    };
  }

  return { SOON_DAYS, summary };
})();

export { Dashboard };
