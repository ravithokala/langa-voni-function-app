// @ts-check
// GENERATED from apps-script/domain/stages.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * Where a shopping item is (ADR-008). A dress goes To buy → Bought → Given for stitching → Trial → Ready → Collected;
 * a jewellery piece To buy → Ordered → Ready → Collected (ADR-014); anything else To buy → Bought. Anything someone
 * else buys (Bought by) or pays for (Paid by) goes Expected → Received instead (ADR-019). Tapping a stage moves it one
 * step on. A dress or a piece of jewellery we buy is done once Ready, one others buy or pay for once Received, anything
 * else once Bought.
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
  /** @type {ReadonlyArray<{ id: Stage, label: string }>} */
  const GIFT = Object.freeze([
    Object.freeze({ id: /** @type {Stage} */ ('expected'), label: 'Expected' }),
    Object.freeze({ id: /** @type {Stage} */ ('received'), label: 'Received' }),
  ]);
  const ALL = Object.freeze([...DRESS, JEWELLERY[1], ...GIFT]);

  /**
   * @typedef {{ section?: string|null, gifted_by?: string|null, bought_by?: string|null }} Shape
   */
  /** Paid for with someone else's money (Paid by; the `gifted_by` column): not counted in the budget (ADR-019). @param {Shape} item */
  const isGift = (item) => Boolean(item.gifted_by);

  /** Bought or paid for by someone else: we wait for it, Expected → Received, and it is not on To do's To buy. @param {Shape} item */
  const byOthers = (item) => isGift(item) || Boolean(item.bought_by);

  /**
   * The stages of a section; anything others buy or pay for has its own two.
   * @param {ItemSection|string|null|undefined} section @param {boolean} [others]
   */
  const forSection = (section, others = false) => (others ? GIFT : section === 'dresses' ? DRESS : section === 'jewellery' ? JEWELLERY : OTHER);

  /** @param {Shape} item */
  const forItem = (item) => forSection(item.section, byOthers(item));

  /** Followed from order to ready, with a promised-by date (dresses and jewellery we buy ourselves). @param {Shape} item */
  const isTracked = (item) => !byOthers(item) && (item.section === 'dresses' || item.section === 'jewellery');

  /** @param {ItemSection|string|null|undefined} section @param {unknown} stage @param {boolean} [others] @returns {stage is Stage} */
  const isValid = (section, stage, others = false) => forSection(section, others).some((s) => s.id === stage);

  /** @param {string} stage */
  function label(stage) {
    const found = ALL.find((s) => s.id === stage);
    return found ? found.label : '';
  }

  /** The stage after this one, or null at the last. @param {Shape} item @param {Stage} stage @returns {Stage|null} */
  function next(item, stage) {
    const list = forItem(item);
    const i = list.findIndex((s) => s.id === stage);
    return i === -1 || i === list.length - 1 ? null : list[i + 1].id;
  }

  /**
   * A stage that fits after the item became, or stopped being, a gift: the first stage, or the last when it was done.
   * @param {Shape} item @param {Stage} stage @returns {Stage}
   */
  function fit(item, stage) {
    const list = forItem(item);
    if (list.some((s) => s.id === stage)) return stage;
    const wasDone = stage === 'ready' || stage === 'collected' || stage === 'received' || stage === 'bought';
    return wasDone ? list[list.length - 1].id : list[0].id;
  }

  /** At Ready or Collected (a dress or jewellery we buy), Received (others buy or pay), or Bought (anything else). @param {Pick<Item, 'section'|'stage'> & Shape} item */
  function isDone(item) {
    if (!isValid(item.section, item.stage, byOthers(item))) return false;
    if (byOthers(item)) return item.stage === 'received';
    return isTracked(item) ? item.stage === 'ready' || item.stage === 'collected' : item.stage === 'bought';
  }

  /**
   * A dress or piece of jewellery we buy whose promised-by date has passed and is not Ready yet.
   * @param {Pick<Item, 'section'|'stage'|'ready_by'|'deleted'> & Shape} item @param {string} today
   */
  const isLate = (item, today) => !item.deleted && isTracked(item) && !isDone(item) && item.ready_by !== null && item.ready_by < today;

  return { DRESS, JEWELLERY, GIFT, OTHER, isGift, byOthers, forSection, forItem, isTracked, isValid, label, next, fit, isDone, isLate };
})();

export { Stages };
