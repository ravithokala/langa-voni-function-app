// @ts-check
// GENERATED from apps-script/domain/budget.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.
import { Model } from './model.js';
import { Money } from './money.js';

/**
 * The budget (ADR-008): the Shopping section comes straight from the shopping items, then each
 * budget section (the suggested ones in their order, then the rest A–Z). Every line has a total,
 * an advance given and a balance; a line with no total yet counts as nothing and is flagged.
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Budget = (() => {
  /** @param {ReadonlyArray<BudgetRow>} rows @returns {Totals} */
  function totals(rows) {
    let total = 0;
    let advance = 0;
    let unpriced = 0;
    for (const r of rows) {
      if (r.total_paise === null) unpriced += 1;
      else total += r.total_paise;
      advance += r.advance_paise ?? 0;
    }
    return { total, advance, balance: total - advance, unpriced, lines: rows.length };
  }

  /** @param {Item} item @returns {BudgetRow} */
  const fromItem = (item) => ({ kind: 'item', id: item.item_id, name: item.name, vendor: item.vendor, total_paise: item.total_paise,
    advance_paise: item.advance_paise, balance_paise: Money.balance(item.total_paise, item.advance_paise), due_date: null });

  /** @param {BudgetLine} line @returns {BudgetRow} */
  const fromLine = (line) => ({ kind: 'line', id: line.line_id, name: line.name, vendor: line.vendor, total_paise: line.total_paise,
    advance_paise: line.advance_paise, balance_paise: Money.balance(line.total_paise, line.advance_paise), due_date: line.due_date });

  /**
   * @param {ReadonlyArray<Item>} items @param {ReadonlyArray<BudgetLine>} lines
   * @returns {{ sections: BudgetSection[], totals: Totals }}
   */
  function build(items, lines) {
    const byName = (/** @type {BudgetRow} */ a, /** @type {BudgetRow} */ b) => a.name.localeCompare(b.name);
    const shopping = items.filter((i) => !i.deleted).map(fromItem).sort(byName);
    const live = lines.filter((l) => !l.deleted);
    const names = Model.orderNames(live.map((l) => l.section), Model.BUDGET_SECTIONS);
    /** @type {BudgetSection[]} */
    const sections = [{ name: Model.SHOPPING_SECTION, linked: true, rows: shopping, totals: totals(shopping) }];
    for (const name of names) {
      const rows = live.filter((l) => l.section === name).map(fromLine).sort(byName);
      sections.push({ name, linked: false, rows, totals: totals(rows) });
    }
    return { sections, totals: totals(sections.flatMap((s) => s.rows)) };
  }

  return { totals, build };
})();

export { Budget };
