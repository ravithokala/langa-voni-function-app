// @ts-check
// GENERATED from apps-script/domain/guests.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * The invite list (ADR-006): families grouped under their city, with each city's counts, the order chosen by the
 * reorder link and the filter chips (ADR-018: All, Not informed, Not invited, Done).
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Guests = (() => {
  /** The reorder link cycles through these, in this order. */
  const ORDERS = Object.freeze([
    Object.freeze({ id: /** @type {GuestOrder} */ ('not-informed'), label: 'Not informed first' }),
    Object.freeze({ id: /** @type {GuestOrder} */ ('not-invited'), label: 'Not invited first' }),
    Object.freeze({ id: /** @type {GuestOrder} */ ('name'), label: 'A–Z' }),
  ]);

  /** The filter chips (ADR-018). Done: informed and invited. */
  const FILTERS = Object.freeze([
    Object.freeze({ id: /** @type {GuestFilter} */ ('all'), label: 'All' }),
    Object.freeze({ id: /** @type {GuestFilter} */ ('not-informed'), label: 'Not informed' }),
    Object.freeze({ id: /** @type {GuestFilter} */ ('not-invited'), label: 'Not invited' }),
    Object.freeze({ id: /** @type {GuestFilter} */ ('done'), label: 'Done' }),
  ]);

  /** @param {unknown} filter @returns {GuestFilter} */
  const filterOr = (filter) => (FILTERS.some((f) => f.id === filter) ? /** @type {GuestFilter} */ (filter) : 'all');

  /** Whether a family is shown under a filter. @param {Guest} g @param {GuestFilter} filter */
  function matches(g, filter) {
    if (filter === 'not-informed') return !g.informed;
    if (filter === 'not-invited') return !g.invited;
    if (filter === 'done') return g.informed && g.invited;
    return true;
  }

  /** @param {unknown} order @returns {GuestOrder} */
  const orderOr = (order) => (ORDERS.some((o) => o.id === order) ? /** @type {GuestOrder} */ (order) : 'name');

  /** The order after this one. @param {GuestOrder} order @returns {GuestOrder} */
  function nextOrder(order) {
    const i = ORDERS.findIndex((o) => o.id === order);
    return ORDERS[(i + 1) % ORDERS.length].id;
  }

  /** @param {string} order */
  const orderLabel = (order) => (ORDERS.find((o) => o.id === order) ?? ORDERS[2]).label;

  /** @param {ReadonlyArray<Guest>} guests @returns {GuestCounts} */
  function counts(guests) {
    const live = guests.filter((g) => !g.deleted);
    const people = (/** @type {Guest[]} */ list) => list.reduce((sum, g) => sum + (g.headcount ?? 0), 0);
    const informed = live.filter((g) => g.informed);
    const invited = live.filter((g) => g.invited);
    return { families: live.length, people: people(live), informed: informed.length, informedPeople: people(informed),
      invited: invited.length, invitedPeople: people(invited) };
  }

  /** @param {GuestOrder} order @returns {(a: Guest, b: Guest) => number} */
  function comparer(order) {
    const byName = (/** @type {Guest} */ a, /** @type {Guest} */ b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (order === 'not-informed') return (a, b) => Number(a.informed) - Number(b.informed) || byName(a, b);
    if (order === 'not-invited') return (a, b) => Number(a.invited) - Number(b.invited) || byName(a, b);
    return byName;
  }

  /**
   * Each city (in its own order, then A–Z) with its families in the chosen order. `filter` keeps only the families
   * it matches. `search` keeps only families whose name contains it, and cities whose name contains it keep all their
   * (filtered) families; a city with no family left is dropped while searching or filtering. `counts` are always the
   * whole city's. Families whose city was removed are not shown.
   * @param {ReadonlyArray<City>} cities @param {ReadonlyArray<Guest>} guests
   * @param {{ order?: GuestOrder, search?: string, filter?: GuestFilter }} [view]
   * @returns {CityGroup[]}
   */
  function group(cities, guests, view = {}) {
    const order = orderOr(view.order);
    const search = (view.search ?? '').trim().toLowerCase();
    const filter = filterOr(view.filter);
    const narrowing = search !== '' || filter !== 'all';
    const live = cities.filter((c) => !c.deleted)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
    return live.map((city) => {
      const all = guests.filter((g) => !g.deleted && g.city_id === city.city_id);
      const cityHit = search !== '' && city.name.toLowerCase().includes(search);
      const kept = all.filter((g) => matches(g, filter));
      const shown = search === '' || cityHit ? kept : kept.filter((g) => g.name.toLowerCase().includes(search));
      return { city, guests: [...shown].sort(comparer(order)), counts: counts(all) };
    }).filter((g) => !narrowing || g.guests.length > 0 || (filter === 'all' && g.city.name.toLowerCase().includes(search)));
  }

  return { ORDERS, FILTERS, orderOr, filterOr, matches, nextOrder, orderLabel, counts, group };
})();

export { Guests };
