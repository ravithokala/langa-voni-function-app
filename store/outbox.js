// @ts-check

/**
 * The phone's queue of changes waiting to be saved (ADR-013): adds and quick taps show at once, are kept on the phone
 * (they survive closing the app or losing signal) and are sent one at a time, in order. Pure rules only, so they run in
 * Node tests: what each change sends, and what an answer means for it. store.js keeps the queue and sends it.
 *
 * A change carries no version: the version is read from the phone's copy when it is sent, after the changes before
 * it have been saved. A new row carries its own id (made on the phone), so a repeat of an add that did arrive is
 * recognised and not made twice.
 *
 * @typedef {'city'|'guest'|'item'|'line'|'task'} Kind
 * @typedef {{ type: 'add', key: string, kind: Kind, rowId: string, fields: Record<string, unknown>, row: Record<string, unknown> }
 *   | { type: 'mark', key: string, kind: 'guest', rowId: string, field: 'informed'|'invited', value: boolean }
 *   | { type: 'stage', key: string, kind: 'item', rowId: string, stage: Stage }
 *   | { type: 'done', key: string, kind: 'task', rowId: string, done: boolean }} Change
 * @typedef {Change & { failed?: string|null, tries?: number, conflicts?: number }} Job
 * @typedef {{ ok: boolean, data: any, errors: Array<{ code: string, message: string }> }} Answer
 * @typedef {{ kind: 'saved' } | { kind: 'resend' } | { kind: 'failed', message: string } | { kind: 'dropped', message: string }} Outcome
 *   saved: done with; resend: the row changed elsewhere, send again on the newer version; failed: an add the server refused,
 *   kept on screen as Not saved; dropped: a tap the server refused, taken off (a refresh puts the screen right)
 */

/** The table behind each kind, and its id field. */
export const TABLE = Object.freeze({ city: 'cities', guest: 'guests', item: 'items', line: 'budget', task: 'tasks' });
export const ID_FIELD = Object.freeze({ city: 'city_id', guest: 'guest_id', item: 'item_id', line: 'line_id', task: 'task_id' });

/** How many times a change is sent again after the row was changed elsewhere, before giving up. */
const MAX_CONFLICTS = 2;

/**
 * The request for a change.
 * @param {Change} job
 * @param {(kind: Kind, id: string) => number} versionOf  the version of the row on this phone now (0 if none)
 * @returns {{ action: string, payload: Record<string, unknown> }}
 */
export function request(job, versionOf) {
  const base_version = versionOf(job.kind, job.rowId);
  if (job.type === 'add') return { action: `${job.kind}.save`, payload: { id: job.rowId, base_version: 0, fields: job.fields } };
  if (job.type === 'mark') return { action: 'guest.mark', payload: { id: job.rowId, base_version, [job.field]: job.value } };
  if (job.type === 'stage') return { action: 'item.advance', payload: { id: job.rowId, base_version, stage: job.stage } };
  return { action: 'task.done', payload: { id: job.rowId, base_version, done: job.done } };
}

/**
 * What an answer means for the change.
 * @param {Job} job @param {Answer} answer
 * @returns {Outcome}
 */
export function outcome(job, answer) {
  if (answer.ok) return { kind: 'saved' };
  const conflict = answer.errors.some((e) => e.code === 'CONFLICT');
  const rows = answer.data?.rows?.[TABLE[job.kind]] ?? [];
  const words = answer.errors.map((e) => e.message).join('; ') || 'refused';
  if (job.type === 'add') {
    // The add arrived before (a resend after the app was closed): the row is there with this phone's id.
    if (conflict && rows.some((/** @type {any} */ r) => r[ID_FIELD[job.kind]] === job.rowId)) return { kind: 'saved' };
    return { kind: 'failed', message: words };
  }
  // A tap sets a value (not "the opposite"), so sending it again on the newer version is safe.
  if (conflict && rows.length && (job.conflicts ?? 0) < MAX_CONFLICTS) return { kind: 'resend' };
  return { kind: 'dropped', message: words };
}

/**
 * Applies a change to a row on screen before it is saved. Returns the row as it should be shown.
 * @param {Job} job @param {Record<string, unknown>|undefined} row  the row on the phone, if any
 * @returns {Record<string, unknown>|null}
 */
export function overlay(job, row) {
  if (job.type === 'add') return row && Number(row.version) > 0 ? row : { ...job.row };
  if (!row) return null;
  if (job.type === 'mark') return { ...row, [job.field]: job.value };
  if (job.type === 'stage') return { ...row, stage: job.stage };
  return { ...row, done: job.done };
}

/**
 * Adds a change to the queue. A tap on a row replaces an earlier tap of the same kind still waiting (only the last
 * value matters), so tapping a tick on and off while offline sends one change, not two.
 * The change being sent at the moment (`sending`) is never replaced: the new one follows it.
 * @param {Job[]} queue @param {Job} job @param {string|null} [sending]  the key of the change on its way
 * @returns {Job[]}
 */
export function enqueue(queue, job, sending = null) {
  if (job.type === 'add') return [...queue, job];
  const same = (/** @type {Job} */ j) => !j.failed && j.key !== sending && j.type === job.type && j.rowId === job.rowId && (job.type !== 'mark' || /** @type {any} */ (j).field === job.field);
  const at = queue.findIndex(same);
  if (at === -1) return [...queue, job];
  // Keep its place, so it is still sent after the add it may depend on.
  return queue.map((j, i) => (i === at ? job : j));
}

/** Reads a saved queue, dropping anything that is not a change. @param {string|null} text @returns {Job[]} */
export function parse(text) {
  if (!text) return [];
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? list.filter((j) => j && typeof j.key === 'string' && typeof j.rowId === 'string' && j.kind in TABLE
      && ['add', 'mark', 'stage', 'done'].includes(j.type)) : [];
  } catch (e) {
    return [];
  }
}
