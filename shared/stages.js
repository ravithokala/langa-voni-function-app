// @ts-check
// GENERATED from apps-script/domain/stages.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * Where a shopping item is (ADR-008). A dress goes To buy → Bought → Given for stitching → Trial → Ready → Collected;
 * a jewellery piece To buy → Ordered → Ready → Collected (ADR-014); anything else To buy → Bought. Tapping a stage
 * moves it one step on. A dress or a piece of jewellery is done once Ready; anything else once Bought.
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
  /** @type {ReadonlyArray<{ id: Stage, label: string }>} */
  const JEWELLERY = Object.freeze([DRESS[0], Object.freeze({ id: /** @type {Stage} */ ('ordered'), label: 'Ordered' }), DRESS[4], DRESS[5]]);
  const ALL = Object.freeze([...DRESS, JEWELLERY[1]]);

  /** @param {ItemSection|string|null|undefined} section */
  const forSection = (section) => (section === 'dresses' ? DRESS : section === 'jewellery' ? JEWELLERY : OTHER);

  /** Followed from order to ready, with a promised-by date (dresses and jewellery). @param {ItemSection|string|null|undefined} section */
  const isTracked = (section) => section === 'dresses' || section === 'jewellery';

  /** @param {ItemSection|string|null|undefined} section @param {unknown} stage @returns {stage is Stage} */
  const isValid = (section, stage) => forSection(section).some((s) => s.id === stage);

  /** @param {string} stage */
  function label(stage) {
    const found = ALL.find((s) => s.id === stage);
    return found ? found.label : '';
  }

  /** The stage after this one, or null at the last. @param {ItemSection|string} section @param {Stage} stage @returns {Stage|null} */
  function next(section, stage) {
    const list = forSection(section);
    const i = list.findIndex((s) => s.id === stage);
    return i === -1 || i === list.length - 1 ? null : list[i + 1].id;
  }

  /** At Ready or Collected (a dress or jewellery), or Bought (anything else). @param {Pick<Item, 'section'|'stage'>} item */
  function isDone(item) {
    if (!isValid(item.section, item.stage)) return false;
    return isTracked(item.section) ? item.stage === 'ready' || item.stage === 'collected' : item.stage === 'bought';
  }

  /**
   * A dress or piece of jewellery whose promised-by date has passed and is not Ready yet.
   * @param {Pick<Item, 'section'|'stage'|'ready_by'|'deleted'>} item @param {string} today
   */
  const isLate = (item, today) => !item.deleted && isTracked(item.section) && !isDone(item) && item.ready_by !== null && item.ready_by < today;

  return { DRESS, JEWELLERY, OTHER, forSection, isTracked, isValid, label, next, isDone, isLate };
})();

export { Stages };
