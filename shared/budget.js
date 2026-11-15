// @ts-check
// GENERATED from apps-script/domain/budget.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.
import { Model } from './model.js';
import { Money } from './money.js';
import { Weight } from './weight.js';
import { Stages } from './stages.js';

/**
 * The budget (ADR-008, ADR-015, ADR-016): four sections come straight from the shopping items: Shopping (dresses and
 * other things), Jewellery (pieces bought), Gifted jewellery (pieces given: who gave them and their weight) and Brought by
 * others (dresses and other things someone else brings). The last two are listed but not counted in the totals, as no
 * money is spent. Then each budget section (the suggested ones in their order, then
 * the rest A–Z). Every line has a total, an advance given and a balance; a line with no total yet counts as nothing
 * and is flagged.
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
  const fromItem = (item) => ({ kind: 'item', id: item.item_id, name: item.name, vendor: item.vendor, for_whom: item.for_whom,
    weight_mg: item.weight_mg ?? null, metal: item.section === 'jewellery' ? Model.metalOf(item) : null, gifted_by: item.gifted_by ?? null, total_paise: item.total_paise,
    advance_paise: item.advance_paise, balance_paise: Money.balance(item.total_paise, item.advance_paise), due_date: null });

  /** @param {BudgetLine} line @returns {BudgetRow} */
  const fromLine = (line) => ({ kind: 'line', id: line.line_id, name: line.name, vendor: line.vendor, for_whom: null, weight_mg: null, metal: null,
    gifted_by: null, total_paise: line.total_paise,
    advance_paise: line.advance_paise, balance_paise: Money.balance(line.total_paise, line.advance_paise), due_date: line.due_date });

  /**
   * @param {ReadonlyArray<Item>} items @param {ReadonlyArray<BudgetLine>} lines
   * @returns {{ sections: BudgetSection[], totals: Totals }}
   */
  function build(items, lines) {
    const byName = (/** @type {BudgetRow} */ a, /** @type {BudgetRow} */ b) => a.name.localeCompare(b.name);
    const bought = items.filter((i) => !i.deleted && !Stages.isGift(i));
    const rows = (/** @type {Item[]} */ list) => list.map(fromItem).sort(byName);
    const shopping = rows(bought.filter((i) => i.section !== 'jewellery'));
    const jewellery = rows(bought.filter((i) => i.section === 'jewellery'));
    const given = items.filter((i) => !i.deleted && Stages.isGift(i));
    const gifts = rows(given.filter((i) => i.section === 'jewellery'));
    const brought = rows(given.filter((i) => i.section !== 'jewellery'));
    // Gold and silver are totalled apart, never added together (ADR-017).
    const grams = (/** @type {BudgetRow[]} */ list) => Weight.byMetal(list);
    const live = lines.filter((l) => !l.deleted);
    const names = Model.orderNames(live.map((l) => l.section), Model.BUDGET_SECTIONS);
    /** @type {BudgetSection[]} */
    const sections = [
      { name: Model.SHOPPING_SECTION, linked: true, counted: true, gifts: false, grams: null, rows: shopping, totals: totals(shopping) },
      { name: Model.JEWELLERY_SECTION, linked: true, counted: true, gifts: false, grams: grams(jewellery), rows: jewellery, totals: totals(jewellery) },
      { name: Model.GIFTS_SECTION, linked: true, counted: false, gifts: true, grams: grams(gifts), rows: gifts, totals: totals(gifts) },
      { name: Model.BROUGHT_SECTION, linked: true, counted: false, gifts: true, grams: null, rows: brought, totals: totals(brought) },
    ];
    for (const name of names) {
      const list = live.filter((l) => l.section === name).map(fromLine).sort(byName);
      sections.push({ name, linked: false, counted: true, gifts: false, grams: null, rows: list, totals: totals(list) });
    }
    return { sections, totals: totals(sections.filter((s) => s.counted).flatMap((s) => s.rows)) };
  }

  return { totals, build };
})();

export { Budget };
