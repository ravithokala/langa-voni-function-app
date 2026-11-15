// @ts-check
// GENERATED from apps-script/domain/weight.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * Jewellery weights (ADR-015). Kept as whole milligrams; typed and shown in grams, up to three decimals: '24.5' or
 * '24.5 g' → 24500; 24500 → '24.5 g'.
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Weight = (() => {
  /** The most one piece may weigh: 5 kg. */
  const MAX_MG = 5000000;
  const TYPED = /^(\d+)(?:\.(\d{1,3}))?$/;

  /**
   * Grams typed → milligrams; '' → null; anything else → NaN.
   * @param {unknown} value  text typed, or a number of grams
   * @returns {number|null}
   */
  function parse(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 1000) : NaN;
    if (typeof value !== 'string') return NaN;
    const text = value.replace(/\s+/g, '').replace(/(grams?|gms?|g)$/i, '');
    if (text === '') return null;
    const m = TYPED.exec(text);
    if (!m) return NaN;
    return Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0'));
  }

  /** As it would be typed back: 24500 → '24.5'. @param {number|null|undefined} mg */
  function toInput(mg) {
    if (mg === null || mg === undefined) return '';
    const rest = String(mg % 1000).padStart(3, '0').replace(/0+$/, '');
    return `${Math.floor(mg / 1000)}${rest ? `.${rest}` : ''}`;
  }

  /** 24500 → '24.5 g'; null → ''. @param {number|null|undefined} mg */
  const format = (mg) => (mg === null || mg === undefined || !Number.isFinite(mg) ? '' : `${toInput(mg)} g`);

  /** The total of the weights given, ignoring pieces with none. @param {Array<number|null|undefined>} list */
  const total = (list) => list.reduce((/** @type {number} */ sum, mg) => sum + (mg ?? 0), 0);

  return { MAX_MG, parse, toInput, format, total };
})();

export { Weight };
