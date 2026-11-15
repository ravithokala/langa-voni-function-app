// @ts-check
// GENERATED from apps-script/domain/validation.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.
import { Dates } from './dates.js';
import { Model } from './model.js';
import { Money } from './money.js';
import { Weight } from './weight.js';
import { Stages } from './stages.js';

/**
 * Checks and tidies what someone entered. The server always validates; the phone runs the same
 * checks first. Each function returns the tidied values plus any errors ({ field, code, message }).
 * `known` is what already exists, so references are checked and a name is not used twice side by side.
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Validation = (() => {
  const ID = /^[A-Za-z0-9-]{8,80}$/;
  const LIMITS = Object.freeze({ name: 80, short: 40, note: 300, headcount: 200 });

  /** @param {unknown} value */
  const isId = (value) => typeof value === 'string' && ID.test(value);

  function collector() {
    /** @type {Issue[]} */
    const errors = [];
    return {
      errors,
      /** @param {string} field @param {string} code @param {string} message */
      add(field, code, message) { errors.push({ field, code, message }); },
      /**
       * Text: trimmed. Blank is REQUIRED when `required`, otherwise null.
       * @param {string} field @param {unknown} value @param {number} max @param {boolean} required @returns {string|null}
       */
      text(field, value, max, required) {
        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
          if (required) this.add(field, 'REQUIRED', 'is required');
          return null;
        }
        if (typeof value !== 'string') { this.add(field, 'INVALID', 'must be text'); return null; }
        const trimmed = value.trim().replace(/\s+/g, ' ');
        if (trimmed.length > max) this.add(field, 'TOO_LONG', `must be at most ${max} characters`);
        return trimmed;
      },
      /**
       * A whole number in a range; blank is REQUIRED when `required`, otherwise null.
       * @param {string} field @param {unknown} value @param {number} min @param {number} max @param {boolean} required @returns {number|null}
       */
      int(field, value, min, max, required) {
        if (value === null || value === undefined || value === '') {
          if (required) this.add(field, 'REQUIRED', 'is required');
          return null;
        }
        const n = typeof value === 'string' ? Number(value.trim()) : value;
        if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
          this.add(field, 'INVALID', `must be a whole number from ${min} to ${max}`);
          return null;
        }
        return n;
      },
      /** An optional real date. @param {string} field @param {unknown} value @returns {string|null} */
      date(field, value) {
        if (value === null || value === undefined || value === '') return null;
        if (!Dates.isValid(value)) { this.add(field, 'INVALID', 'must be a real date'); return null; }
        return value;
      },
      /** An optional amount in rupees, kept as paise. @param {string} field @param {unknown} value @returns {number|null} */
      money(field, value) {
        const paise = Money.parse(value);
        if (paise === null) return null;
        if (Number.isNaN(paise)) { this.add(field, 'INVALID', 'must be an amount in rupees, e.g. 12500 or 1,25,000'); return null; }
        if (paise > Money.MAX_PAISE) { this.add(field, 'INVALID', 'is too large'); return null; }
        return paise;
      },
      /** @param {string} field @param {unknown} value */
      flag(field, value) {
        if (value === undefined || value === null || value === '') return false;
        if (typeof value !== 'boolean') { this.add(field, 'INVALID', 'must be yes or no'); return false; }
        return value;
      },
    };
  }

  /**
   * @param {ReadonlyArray<any>} siblings @param {string|null} name @param {string|null|undefined} self
   * @param {(row: any) => string} idOf @param {(row: any) => string} [nameOf]
   */
  function taken(siblings, name, self, idOf, nameOf = (r) => r.name) {
    if (!name) return false;
    const wanted = name.toLowerCase();
    return siblings.some((s) => !s.deleted && String(nameOf(s)).toLowerCase() === wanted && idOf(s) !== self);
  }

  /** An advance larger than the total. @param {ReturnType<typeof collector>} c @param {number|null} total @param {number|null} advance */
  function checkAdvance(c, total, advance) {
    if (total !== null && advance !== null && advance > total) c.add('advance_paise', 'INVALID', 'cannot be more than the total');
  }

  /** The function's name, date and venue. @param {any} input */
  function settings(input) {
    const c = collector();
    const name = c.text('name', input.name, LIMITS.name, true);
    const date = c.date('date', input.date);
    const venue = c.text('venue', input.venue, LIMITS.name, false);
    const note = c.text('note', input.note, LIMITS.note, false);
    return { value: { name, date, venue, note }, errors: c.errors };
  }

  /** @param {any} input @param {{ cities: ReadonlyArray<City>, self?: string|null }} known */
  function city(input, known) {
    const c = collector();
    const name = c.text('name', input.name, LIMITS.short, true);
    if (taken(known.cities, name, known.self, (r) => r.city_id)) c.add('name', 'DUPLICATE', 'is already a city');
    return { value: { name }, errors: c.errors };
  }

  /** A family under a city. @param {any} input @param {{ cities: ReadonlyArray<City>, guests: ReadonlyArray<Guest>, self?: string|null }} known */
  function guest(input, known) {
    const c = collector();
    const name = c.text('name', input.name, LIMITS.name, true);
    const city_id = input.city_id;
    if (!isId(city_id) || !known.cities.some((r) => r.city_id === city_id && !r.deleted)) c.add('city_id', 'INVALID', 'must be an existing city');
    const headcount = c.int('headcount', input.headcount === undefined ? 1 : input.headcount, 1, LIMITS.headcount, true);
    const informed = c.flag('informed', input.informed);
    const invited = c.flag('invited', input.invited);
    const note = c.text('note', input.note, LIMITS.note, false);
    const sameCity = known.guests.filter((g) => g.city_id === city_id);
    if (taken(sameCity, name, known.self, (r) => r.guest_id)) c.add('name', 'DUPLICATE', 'is already in this city');
    return { value: { city_id, name, headcount, informed, invited, note }, errors: c.errors };
  }

  /** A shopping item: a dress, a piece of jewellery (with its weight, and who gave it if a gift), or something else. @param {any} input */
  function item(input) {
    const c = collector();
    const section = Model.ITEM_SECTIONS.some((s) => s.id === input.section) ? /** @type {ItemSection} */ (input.section) : null;
    if (!section) c.add('section', 'INVALID', 'must be Dresses, Jewellery or Other');
    const name = c.text('name', input.name, LIMITS.name, true);
    const for_whom = c.text('for_whom', input.for_whom, LIMITS.short, false);
    const vendor = c.text('vendor', input.vendor, LIMITS.short, false);
    const total_paise = c.money('total_paise', input.total_paise);
    const advance_paise = c.money('advance_paise', input.advance_paise);
    checkAdvance(c, total_paise, advance_paise);
    const jewel = section === 'jewellery';
    // Jewellery: Gifted by; anything else: Brought by (ADR-016). Either way: Expected → Received, not counted in the budget.
    const gifted_by = c.text('gifted_by', input.gifted_by, LIMITS.short, false);
    const weight_mg = jewel ? weight(c, input.weight_mg) : null;
    /** @type {Metal|null} */
    let metal = null;
    if (jewel) {
      metal = 'gold';
      if (input.metal === 'silver' || input.metal === 'gold') metal = input.metal;
      else if (input.metal !== undefined && input.metal !== null && input.metal !== '') c.add('metal', 'INVALID', 'must be Gold or Silver');
    }
    const shape = { section, gifted_by };
    /** @type {Stage} */
    let stage = Stages.forItem(shape)[0].id;
    if (input.stage !== undefined && input.stage !== null && input.stage !== '') {
      if (Stages.isValid(section, input.stage, Stages.isGift(shape))) stage = input.stage;
      // A piece that has just become (or stopped being) a gift keeps the nearest stage of its new kind.
      else if (Stages.isValid(section, input.stage, !Stages.isGift(shape))) stage = Stages.fit(shape, input.stage);
      else c.add('stage', 'INVALID', 'is not a stage for this section');
    }
    const dress = section === 'dresses';
    const tracked = Stages.isTracked(shape);
    const tailor = dress ? c.text('tailor', input.tailor, LIMITS.short, false) : null;
    const given_on = tracked ? c.date('given_on', input.given_on) : null;
    const ready_by = tracked ? c.date('ready_by', input.ready_by) : null;
    if (given_on && ready_by && ready_by < given_on) c.add('ready_by', 'INVALID', `cannot be before the day it was ${dress ? 'given' : 'ordered'}`);
    const note = c.text('note', input.note, LIMITS.note, false);
    return { value: { section, name, for_whom, vendor, total_paise, advance_paise, stage, tailor, given_on, ready_by, note, weight_mg, gifted_by, metal }, errors: c.errors };
  }

  /** A weight typed in grams, kept as milligrams. @param {ReturnType<typeof collector>} c @param {unknown} value @returns {number|null} */
  function weight(c, value) {
    const mg = Weight.parse(value);
    if (mg === null) return null;
    if (Number.isNaN(mg)) { c.add('weight_mg', 'INVALID', 'must be grams, e.g. 24.5'); return null; }
    if (mg > Weight.MAX_MG) { c.add('weight_mg', 'INVALID', 'is too heavy'); return null; }
    return mg;
  }

  /** A budget line outside shopping. @param {any} input */
  function budgetLine(input) {
    const c = collector();
    const section = c.text('section', input.section, LIMITS.short, true);
    if (section && Model.isLinkedSection(section)) {
      c.add('section', 'INVALID', `${section} comes from the Shopping tab: add it there`);
    }
    const name = c.text('name', input.name, LIMITS.name, true);
    const vendor = c.text('vendor', input.vendor, LIMITS.short, false);
    const total_paise = c.money('total_paise', input.total_paise);
    const advance_paise = c.money('advance_paise', input.advance_paise);
    checkAdvance(c, total_paise, advance_paise);
    const due_date = c.date('due_date', input.due_date);
    const note = c.text('note', input.note, LIMITS.note, false);
    return { value: { section, name, vendor, total_paise, advance_paise, due_date, note }, errors: c.errors };
  }

  /** @param {any} input */
  function task(input) {
    const c = collector();
    const category = c.text('category', input.category, LIMITS.short, false) ?? 'Other';
    const title = c.text('title', input.title, LIMITS.name, true);
    const owner = c.text('owner', input.owner, LIMITS.short, false);
    const due_date = c.date('due_date', input.due_date);
    const done = c.flag('done', input.done);
    const note = c.text('note', input.note, LIMITS.note, false);
    return { value: { category, title, owner, due_date, done, note }, errors: c.errors };
  }

  return { LIMITS, isId, settings, city, guest, item, budgetLine, task };
})();

export { Validation };
