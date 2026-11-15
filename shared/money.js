// @ts-check
// GENERATED from apps-script/domain/money.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * Rupees (ADR-007). Amounts are whole paise; shown as ₹ with Indian grouping (₹1,23,456), with
 * paise only when there are some (₹99.50). Typed amounts accept ₹, commas and spaces.
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Money = (() => {
  /** The most one amount may be: ₹10 crore. */
  const MAX_PAISE = 10000000000;
  const TYPED = /^(\d+)(?:\.(\d{1,2}))?$/;

  /**
   * '1,23,456.5' or '₹ 5000' → paise; '' → null; anything else → NaN.
   * @param {unknown} value  text typed, or a number of rupees
   * @returns {number|null}
   */
  function parse(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : NaN;
    if (typeof value !== 'string') return NaN;
    const text = value.replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
    if (text === '') return null;
    const m = TYPED.exec(text);
    if (!m) return NaN;
    return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  }

  /** '1234567' → '12,34,567'. @param {string} digits */
  function group(digits) {
    if (digits.length <= 3) return digits;
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return `${rest},${last3}`;
  }

  /**
   * 12345650 → '₹1,23,456.50'; 500 → '₹5'; null → ''. A negative amount gets a minus sign.
   * @param {number|null|undefined} paise
   */
  function format(paise) {
    if (paise === null || paise === undefined || !Number.isFinite(paise)) return '';
    const sign = paise < 0 ? '−' : '';
    const abs = Math.abs(Math.round(paise));
    const rupees = group(String(Math.floor(abs / 100)));
    const rest = abs % 100;
    return `${sign}₹${rupees}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
  }

  /** The amount as it would be typed back into a field: 12345650 → '123456.50'. @param {number|null|undefined} paise */
  function toInput(paise) {
    if (paise === null || paise === undefined) return '';
    const rest = paise % 100;
    return `${Math.floor(paise / 100)}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
  }

  /** Total − advance; null when the total is not known yet. @param {number|null} total @param {number|null} advance */
  const balance = (total, advance) => (total === null ? null : total - (advance ?? 0));

  return { MAX_PAISE, parse, format, toInput, balance };
})();

export { Money };
