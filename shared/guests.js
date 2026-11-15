// @ts-check
// GENERATED from apps-script/domain/guests.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * The invite list (ADR-006): families grouped under their city, with each city's counts and the
 * order chosen by the reorder link.
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
   * Each city (in its own order, then A–Z) with its families in the chosen order. `search` keeps only families
   * whose name contains it, and cities whose name contains it keep all their families; a city with no family
   * left is dropped while searching. Families whose city was removed are not shown.
   * @param {ReadonlyArray<City>} cities @param {ReadonlyArray<Guest>} guests
   * @param {{ order?: GuestOrder, search?: string }} [view]
   * @returns {CityGroup[]}
   */
  function group(cities, guests, view = {}) {
    const order = orderOr(view.order);
    const search = (view.search ?? '').trim().toLowerCase();
    const live = cities.filter((c) => !c.deleted)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
    return live.map((city) => {
      const all = guests.filter((g) => !g.deleted && g.city_id === city.city_id);
      const cityHit = search !== '' && city.name.toLowerCase().includes(search);
      const shown = search === '' || cityHit ? all : all.filter((g) => g.name.toLowerCase().includes(search));
      return { city, guests: [...shown].sort(comparer(order)), counts: counts(all) };
    }).filter((g) => search === '' || g.guests.length > 0 || g.city.name.toLowerCase().includes(search));
  }

  return { ORDERS, orderOr, nextOrder, orderLabel, counts, group };
})();

export { Guests };
