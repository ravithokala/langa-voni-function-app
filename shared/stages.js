// @ts-check
// GENERATED from apps-script/domain/stages.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * Where a shopping item is (ADR-008). A dress goes To buy → Bought → Given for stitching → Trial →
 * Ready → Collected; anything else is To buy → Bought. Tapping a stage moves it one step on.
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Stages = (() => {
  /** @type {ReadonlyArray<{ id: Stage, label: string }>} */
  const DRESS = Object.freeze([
    { id: /** @type {Stage} */ ('to-buy'), label: 'To buy' },
    { id: /** @type {Stage} */ ('bought'), label: 'Bought' },
    { id: /** @type {Stage} */ ('stitching'), label: 'Given for stitching' },
    { id: /** @type {Stage} */ ('trial'), label: 'Trial' },
    { id: /** @type {Stage} */ ('ready'), label: 'Ready' },
    { id: /** @type {Stage} */ ('collected'), label: 'Collected' },
  ].map((s) => Object.freeze(s)));
  const OTHER = Object.freeze(DRESS.slice(0, 2));

  /** @param {ItemSection|string|null|undefined} section */
  const forSection = (section) => (section === 'dresses' ? DRESS : OTHER);

  /** @param {ItemSection|string|null|undefined} section @param {unknown} stage @returns {stage is Stage} */
  const isValid = (section, stage) => forSection(section).some((s) => s.id === stage);

  /** @param {string} stage */
  function label(stage) {
    const found = DRESS.find((s) => s.id === stage);
    return found ? found.label : '';
  }

  /** The stage after this one, or null at the last. @param {ItemSection|string} section @param {Stage} stage @returns {Stage|null} */
  function next(section, stage) {
    const list = forSection(section);
    const i = list.findIndex((s) => s.id === stage);
    return i === -1 || i === list.length - 1 ? null : list[i + 1].id;
  }

  /** At Ready or Collected (a dress), or Bought (anything else). @param {Pick<Item, 'section'|'stage'>} item */
  function isDone(item) {
    const list = forSection(item.section);
    const at = list.findIndex((s) => s.id === item.stage);
    const doneFrom = item.section === 'dresses' ? 4 : 1;
    return at >= doneFrom;
  }

  /**
   * A dress whose promised-by date has passed and is not Ready yet.
   * @param {Pick<Item, 'section'|'stage'|'ready_by'|'deleted'>} item @param {string} today
   */
  const isLate = (item, today) => !item.deleted && item.section === 'dresses' && !isDone(item) && item.ready_by !== null && item.ready_by < today;

  return { DRESS, OTHER, forSection, isValid, label, next, isDone, isLate };
})();

export { Stages };
