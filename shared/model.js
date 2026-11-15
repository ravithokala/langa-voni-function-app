// @ts-check
// GENERATED from apps-script/domain/model.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * The records' fields (in sheet column order) and their fixed vocabularies. Adding a field at the
 * END of a list is additive (Bootstrap appends the column); any other change to a tab holding
 * live data needs an explicit migration.
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Model = (() => {
  const WHO = ['deleted', 'version', 'updated_at', 'updated_by'];
  /** The one function (ADR-005): one row, id FUNCTION_ID. */
  const SETTINGS_FIELDS = Object.freeze(['function_id', 'name', 'date', 'venue', 'note', ...WHO]);
  const CITY_FIELDS = Object.freeze(['city_id', 'name', 'sort', ...WHO]);
  /** A family invited, under a city (ADR-006). */
  const GUEST_FIELDS = Object.freeze(['guest_id', 'city_id', 'name', 'headcount', 'informed', 'invited', 'note', ...WHO]);
  /** Shopping, dresses and other things (ADR-008). Money in paise. */
  const ITEM_FIELDS = Object.freeze(['item_id', 'section', 'name', 'for_whom', 'vendor', 'total_paise', 'advance_paise', 'stage',
    'tailor', 'given_on', 'ready_by', 'note', ...WHO]);
  /** A budget line outside shopping (ADR-008). */
  const BUDGET_FIELDS = Object.freeze(['line_id', 'section', 'name', 'vendor', 'total_paise', 'advance_paise', 'due_date', 'note', ...WHO]);
  const TASK_FIELDS = Object.freeze(['task_id', 'category', 'title', 'owner', 'due_date', 'done', 'note', ...WHO]);

  const FUNCTION_ID = 'function-main';

  /** @type {ReadonlyArray<{ id: ItemSection, label: string }>} */
  const ITEM_SECTIONS = Object.freeze([
    Object.freeze({ id: /** @type {ItemSection} */ ('dresses'), label: 'Dresses' }),
    Object.freeze({ id: /** @type {ItemSection} */ ('other'), label: 'Other' }),
  ]);

  /** The budget section read live from Shopping; no budget line may use the name. */
  const SHOPPING_SECTION = 'Shopping';
  /** Suggested budget sections, in the order shown; any other name is allowed too. */
  const BUDGET_SECTIONS = Object.freeze(['Venue', 'Catering', 'Decoration', 'Priest/Pooja', 'Photography', 'Travel', 'Return gifts', 'Misc']);
  /** Suggested to-do categories, in the order shown; any other name is allowed too. */
  const TASK_CATEGORIES = Object.freeze(['Decoration selection', 'Dresses to buy', 'Venue', 'Food', 'Invitations', 'Pooja', 'Other']);

  /** @param {string} id */
  function sectionLabel(id) {
    const found = ITEM_SECTIONS.find((s) => s.id === id);
    return found ? found.label : '';
  }

  /**
   * Orders names: the suggested ones first in their order, then the rest A–Z.
   * @param {ReadonlyArray<string>} names @param {ReadonlyArray<string>} suggested
   */
  function orderNames(names, suggested) {
    const rank = (/** @type {string} */ n) => { const i = suggested.findIndex((s) => s.toLowerCase() === n.toLowerCase()); return i === -1 ? suggested.length : i; };
    return [...new Set(names)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }

  return { SETTINGS_FIELDS, CITY_FIELDS, GUEST_FIELDS, ITEM_FIELDS, BUDGET_FIELDS, TASK_FIELDS, FUNCTION_ID, ITEM_SECTIONS,
    SHOPPING_SECTION, BUDGET_SECTIONS, TASK_CATEGORIES, sectionLabel, orderNames };
})();

export { Model };
