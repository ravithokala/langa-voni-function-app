// @ts-check

import { el, uk } from '../dom.js';
import { Money } from '../shared/money.js';
import { Stages } from '../shared/stages.js';

/** @param {string} text */
export const empty = (text) => el('p', { class: 'empty muted' }, text);

/** ₹1,23,456, or a dash when not known. @param {number|null|undefined} paise */
export const rupees = (paise) => (paise === null || paise === undefined ? '—' : Money.format(paise));

/** A progress bar. @param {number} part @param {number} whole @param {string} label */
export const meter = (part, whole, label) => {
  const percent = whole ? Math.round((part / whole) * 100) : 0;
  return el('div', { class: 'meter', role: 'img', 'aria-label': `${label}: ${percent} per cent` }, el('span', { style: { width: `${percent}%` } }));
};

/** The look of a stage: grey to start, amber on the way, rose when ready, green when done; red when late. @param {Item} item @param {string} today */
export function stageClass(item, today) {
  if (Stages.isLate(item, today)) return 'late';
  if (item.stage === 'to-buy') return 'plain';
  if (item.section === 'other' || item.stage === 'collected') return 'done';
  return item.stage === 'ready' ? 'near' : 'mid';
}

/** 'Promised 20/11/2026', 'Late: promised 10/11/2026', or ''. @param {Item} item @param {string} today */
export function promised(item, today) {
  if (!item.ready_by || Stages.isDone(item)) return '';
  return `${Stages.isLate(item, today) ? 'Late: promised' : 'Promised'} ${uk(item.ready_by)}`;
}

/** '3 families · 9 people'. @param {number} families @param {number} people */
export const familiesText = (families, people) => `${families} ${families === 1 ? 'family' : 'families'} · ${people} ${people === 1 ? 'person' : 'people'}`;

/** 'in 3 days', 'today', '2 days ago'. @param {number} days */
export const relDays = (days) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : days > 1 ? `in ${days} days` : days === -1 ? 'yesterday' : `${-days} days ago`);
