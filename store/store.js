// @ts-check

import * as db from './db.js';
import { call, Unreachable, lastTiming } from '../api.js';
import { copyTooOld } from '../freshness.js';
import { Validation } from '../shared/validation.js';
import { Model } from '../shared/model.js';
import { Guests } from '../shared/guests.js';
import { Budget } from '../shared/budget.js';
import { Dashboard } from '../shared/dashboard.js';
import { Stages } from '../shared/stages.js';
import * as Outbox from './outbox.js';

/**
 * The app's data: the sheet is the master copy; this phone keeps a copy in IndexedDB so the app opens at once and can be
 * viewed offline. Each change is checked here first (the server's own rules). Adds from the quick boxes and the quick
 * taps (Informed, Invited, a stage, a to-do done) go into a queue kept on the phone (ADR-013, store/outbox.js): they show
 * at once and are sent one at a time, in order, also after the app was closed or the signal lost. Changes made in a
 * form are sent straight away and wait for the answer. The rows the server returns replace this phone's copies. The copy
 * refreshes on opening, on returning to the app, when the connection returns, and every five minutes (to pick up the
 * others' changes). A refresh is always the whole data: it is small; it never takes away a change saved while it ran,
 * nor one still waiting in the queue.
 */

/** @typedef {'settings'|'cities'|'guests'|'items'|'budget'|'tasks'} Table */
/** @type {Record<Table, string>} */
const ID_FIELD = { settings: 'function_id', cities: 'city_id', guests: 'guest_id', items: 'item_id', budget: 'line_id', tasks: 'task_id' };
/** @type {ReadonlyArray<Table>} */
const TABLES = ['settings', 'cities', 'guests', 'items', 'budget', 'tasks'];
/** The table behind each kind of row the forms save. */
const KINDS = Object.freeze({ city: 'cities', guest: 'guests', item: 'items', line: 'budget', task: 'tasks' });

/**
 * @type {{ settings: Record<string, Settings>, cities: Record<string, City>, guests: Record<string, Guest>, items: Record<string, Item>, budget: Record<string, BudgetLine>, tasks: Record<string, Task> }}
 */
export const data = { settings: {}, cities: {}, guests: {}, items: {}, budget: {}, tasks: {} };

export const status = {
  user: '',
  users: /** @type {string[]} */ ([]),
  lastSynced: /** @type {number|null} */ (null),
  online: navigator.onLine,
  refreshing: false,
  /** Why the last refresh failed, if it did (not when simply offline). */
  error: /** @type {string|null} */ (null),
  /** How long the last refresh took (shown beside the version in More). */
  timing: /** @type {typeof lastTiming|null} */ (null),
  sheetUrl: /** @type {string|null} */ (null),
};

/** @type {Set<() => void>} */
const listeners = new Set();
/** Called after anything changes (data or status). @param {() => void} fn */
export const onChange = (fn) => { listeners.add(fn); };
const changed = () => listeners.forEach((fn) => fn());
/** Redraws the screen (after something only the screen knows about, such as a tap that has finished). */
export const touch = () => changed();

/** Rows saves have answered with since the running refresh began: its answer, read before, must not undo them. */
/** @type {Array<{ table: Table, row: any }>} */
let savedSincePull = [];

/** Rows a save answered with. @param {Partial<ChangedRows>} rows */
function applyRows(rows) {
  for (const table of TABLES) {
    for (const row of /** @type {any[]} */ (rows[table] ?? [])) {
      /** @type {any} */ (data[table])[row[ID_FIELD[table]]] = row;
      if (running) savedSincePull.push({ table, row });
    }
  }
  showQueued();
}

/** @param {ChangedRows} rows */
function replaceAll(rows) {
  for (const table of TABLES) /** @type {any} */ (data)[table] = Object.fromEntries(/** @type {any[]} */ (rows[table]).map((r) => [r[ID_FIELD[table]], r]));
}

/** Loads this phone's copy. @returns {Promise<boolean>} whether there was one */
export async function load() {
  let saved = await db.loadAll();
  // A copy not refreshed for 30 days is removed, not shown: the session has ended by then too.
  if (copyTooOld(saved.meta.lastSynced, Date.now())) {
    await db.clearAll();
    saved = await db.loadAll();
  }
  replaceAll(saved.rows);
  showQueued();
  status.user = saved.meta.user ?? '';
  status.users = saved.meta.users ?? [];
  status.lastSynced = saved.meta.lastSynced ?? null;
  status.sheetUrl = saved.meta.sheetUrl ?? null;
  changed();
  return status.lastSynced !== null;
}

// ---- Reading what is on this phone ----

/** @template T @param {Record<string, T & { deleted: boolean }>} rows @returns {T[]} */
const live = (rows) => Object.values(rows).filter((r) => !r.deleted);
/** @template T @param {Record<string, T>} rows @returns {T[]} */
const every = (rows) => Object.values(rows);

/** The function's name, date and venue, or null before it is set up. @returns {Settings|null} */
export const fn = () => (data.settings[Model.FUNCTION_ID] && !data.settings[Model.FUNCTION_ID].deleted ? data.settings[Model.FUNCTION_ID] : null);
/** Cities in their order. */
export const cities = () => live(data.cities).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
/** The invite list, grouped by city. @param {{ order?: GuestOrder, search?: string }} view */
export const guestGroups = (view) => Guests.group(every(data.cities), every(data.guests), view);
/** Everyone, for the totals at the top (families under a removed city are left out). */
export const guestTotals = () => {
  const ids = new Set(cities().map((c) => c.city_id));
  return Guests.counts(live(data.guests).filter((g) => ids.has(g.city_id)));
};
/** One section's shopping, things not done first, then by name. @param {ItemSection} section */
export const items = (section) => live(data.items).filter((i) => i.section === section)
  .sort((a, b) => Number(Stages.isDone(a)) - Number(Stages.isDone(b)) || a.name.localeCompare(b.name));
/** The budget: Shopping, then each section. */
export const budget = () => Budget.build(every(data.items), every(data.budget));
/** Every to-do (removed ones left out). */
export const tasks = () => live(data.tasks);
/** Budget section names already used, for suggestions. */
export const budgetSections = () => Model.orderNames([...Model.BUDGET_SECTIONS, ...live(data.budget).map((l) => l.section)], Model.BUDGET_SECTIONS);
/** To-do categories already used, for suggestions. */
export const taskCategories = () => Model.orderNames([...Model.TASK_CATEGORIES, ...live(data.tasks).map((t) => t.category)], Model.TASK_CATEGORIES);
/** The Home screen's figures. @param {string} today */
export const summary = (today) => Dashboard.summary({ settings: every(data.settings), cities: every(data.cities), guests: every(data.guests),
  items: every(data.items), budget: every(data.budget), tasks: every(data.tasks) }, today);

const ORDER_KEY = 'lv.guestOrder';

/** The order the reorder link last chose, remembered on this phone (ADR-006). @returns {GuestOrder} */
export function guestOrder() {
  try { return Guests.orderOr(localStorage.getItem(ORDER_KEY)); } catch (e) { return 'name'; }
}

/** @param {GuestOrder} order */
export function setGuestOrder(order) {
  try { localStorage.setItem(ORDER_KEY, order); } catch (e) { /* not remembered */ }
  changed();
}

// ---- Saving ----

/** @param {string} message @returns {{ ok: false, errors: Issue[] }} */
const refuse = (message) => ({ ok: false, errors: [{ field: 'request', code: 'NOT_SAVED', message }] });

/** Whether a failure means this phone has no connection (not just a busy server). @param {unknown} e */
const isOffline = (e) => !navigator.onLine || (e instanceof Unreachable && e.offline);

/** @typedef {{ ok: true, rows: ChangedRows, data: any } | { ok: false, errors: Issue[] }} SaveResult */

/**
 * Sends one save. The rows it answers with (what was saved, or for a refused edit the current row) replace this phone's.
 * @param {string} action @param {unknown} payload
 * @returns {Promise<SaveResult>}
 */
async function send(action, payload) {
  if (!navigator.onLine) return refuse("You're offline: connect to save. Everything here can still be viewed.");
  /** @type {import('../api.js').ApiResponse} */
  let r;
  try {
    // A save (app-kit's api.js): a short first try, then one automatic retry carrying the same id, which the server
    // applies once, so a save that did arrive the first time is not made twice.
    r = await call(action, payload);
  } catch (e) {
    return refuse(isOffline(e) ? "You're offline: connect to save." : `${e instanceof Error ? e.message : String(e)}. Nothing was lost: try again in a moment.`);
  }
  if (r.data?.rows) {
    applyRows(r.data.rows);
    await db.saveRows(r.data.rows);
    changed();
  }
  return r.ok ? { ok: true, rows: r.data.rows, data: r.data } : { ok: false, errors: r.errors };
}

/** @param {Issue[]} errors @returns {Promise<SaveResult>} */
const invalid = (errors) => Promise.resolve({ ok: /** @type {const} */ (false), errors });

/** The version this phone has of a row (0 if none). @param {keyof typeof KINDS} kind @param {string|null} id */
const versionOf = (kind, id) => (id ? /** @type {any} */ (data[KINDS[kind]])[id]?.version ?? 0 : 0);

/** The shared rules for each kind, as the server runs them. @type {Record<keyof typeof KINDS, (fields: any, self: string|null) => { errors: Issue[] }>} */
const CHECKS = {
  city: (f, self) => Validation.city(f, { cities: every(data.cities), self }),
  guest: (f, self) => Validation.guest(f, { cities: every(data.cities), guests: every(data.guests), self }),
  item: (f) => Validation.item(f),
  line: (f) => Validation.budgetLine(f),
  task: (f) => Validation.task(f),
};

/**
 * Adds (no id) or changes a city, family, shopping item, budget line or to-do.
 * @param {keyof typeof KINDS} kind @param {string|null} id @param {Record<string, unknown>} fields
 */
export function save(kind, id, fields) {
  const checked = CHECKS[kind](fields, id);
  if (checked.errors.length) return invalid(checked.errors);
  return send(`${kind}.save`, { id: id ?? undefined, base_version: versionOf(kind, id), fields });
}

/** @param {keyof typeof KINDS} kind @param {string} id */
export const remove = (kind, id) => send(`${kind}.remove`, { id, base_version: versionOf(kind, id) });

/** The function's name, date, venue and note. @param {Record<string, unknown>} fields */
export function saveSettings(fields) {
  const checked = Validation.settings(fields);
  if (checked.errors.length) return invalid(checked.errors);
  return send('settings.save', { base_version: data.settings[Model.FUNCTION_ID]?.version ?? 0, fields });
}

// ---- The queue of changes kept on the phone (ADR-013) ----

const QUEUE_KEY = 'lv.outbox';
/** @type {import('./outbox.js').Job[]} */
let queue = [];
try { queue = Outbox.parse(localStorage.getItem(QUEUE_KEY)); } catch (e) { /* none kept */ }
/** The key of the change on its way to the server. @type {string|null} */
let sending = null;
/** Whether the app is signed in and may send (set by keepInStep). */
let sendingAllowed = false;

/** @type {Set<(message: string) => void>} */
const noticeListeners = new Set();
/** Called with a message when a queued tap was refused and taken back. @param {(message: string) => void} fn */
export const onNotice = (fn) => { noticeListeners.add(fn); };

function keepQueue() {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch (e) { /* kept in memory only */ }
}

/** Shows every waiting change on the phone's copy (new rows, ticks, stages). */
function showQueued() {
  for (const job of queue) {
    const table = /** @type {Table} */ (Outbox.TABLE[job.kind]);
    const shown = Outbox.overlay(job, /** @type {any} */ (data[table])[job.rowId]);
    if (shown) /** @type {any} */ (data[table])[job.rowId] = shown;
  }
}

/** @param {import('./outbox.js').Job} job */
function add(job) {
  queue = Outbox.enqueue(queue, job, sending);
  keepQueue();
  showQueued();
  changed();
  flush();
}

const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Adds a family, a dress or item, or a to-do at once, saved behind. Checked here first (the server's own rules).
 * @param {'guest'|'item'|'task'} kind @param {Record<string, unknown>} fields
 * @returns {{ ok: true, id: string } | { ok: false, errors: Issue[] }}
 */
export function queueAdd(kind, fields) {
  const checked = CHECKS[kind](fields, null);
  if (checked.errors.length) return { ok: false, errors: checked.errors };
  const id = crypto.randomUUID();
  const row = { .../** @type {any} */ (checked).value, [Outbox.ID_FIELD[kind]]: id, deleted: false, version: 0, updated_at: null, updated_by: status.user || null };
  add({ type: 'add', key: newKey(), kind, rowId: id, fields, row });
  return { ok: true, id };
}

/** Informed or Invited, one tap: shown at once, saved behind. @param {string} id @param {'informed'|'invited'} field @param {boolean} value */
export const markGuest = (id, field, value) => add({ type: 'mark', key: newKey(), kind: 'guest', rowId: id, field, value });

/** A shopping item to a stage: shown at once, saved behind. @param {string} id @param {Stage} stage */
export const setStage = (id, stage) => add({ type: 'stage', key: newKey(), kind: 'item', rowId: id, stage });

/** A to-do done or not: shown at once, saved behind. @param {string} id @param {boolean} done */
export const markTask = (id, done) => add({ type: 'done', key: newKey(), kind: 'task', rowId: id, done });

/**
 * Whether a row has changes waiting: 'saving', a message if its add was refused (Not saved), or null.
 * @param {string} id @returns {null | 'saving' | { failed: string }}
 */
export function rowState(id) {
  const jobs = queue.filter((j) => j.rowId === id);
  const failed = jobs.find((j) => j.failed);
  if (failed) return { failed: /** @type {string} */ (failed.failed) };
  return jobs.length ? 'saving' : null;
}

/** How many changes are waiting, and how many of those were refused. */
export const queued = () => ({ waiting: queue.filter((j) => !j.failed).length, failed: queue.filter((j) => j.failed).length });

/** Sends a refused add again (after changing nothing, or once the problem is fixed elsewhere). @param {string} id */
export function retry(id) {
  for (const j of queue) if (j.rowId === id) { j.failed = null; j.tries = 0; }
  keepQueue();
  changed();
  flush();
}

/** Gives up a refused add: it leaves the phone. @param {string} id */
export function discard(id) {
  const jobs = queue.filter((j) => j.rowId === id);
  queue = queue.filter((j) => j.rowId !== id);
  for (const j of jobs) {
    const table = /** @type {any} */ (data[/** @type {Table} */ (Outbox.TABLE[j.kind])]);
    if (j.type === 'add' && table[id] && table[id].version === 0) delete table[id];
  }
  keepQueue();
  changed();
}

/** @type {Promise<void>|null} */
let flushing = null;

/** Sends the waiting changes, one at a time, in order. A call while it runs shares it. */
export function flush() {
  if (!flushing) flushing = drain().finally(() => { flushing = null; });
  return flushing;
}

/** @param {string} kind @param {string} id */
const versionNow = (kind, id) => /** @type {any} */ (data[/** @type {Table} */ (Outbox.TABLE[/** @type {import('./outbox.js').Kind} */ (kind)])])[id]?.version ?? 0;

async function drain() {
  for (;;) {
    const job = queue.find((j) => !j.failed);
    if (!job || !sendingAllowed || !navigator.onLine) return;
    const { action, payload } = Outbox.request(job, versionNow);
    sending = job.key;
    /** @type {import('../api.js').ApiResponse} */
    let answer;
    try {
      answer = await call(action, payload);
    } catch (e) {
      sending = null;
      // No answer: left in the queue and sent again on the next refresh, return to the app, or reconnecting. An add that
      // gets no answer three times running is shown as Not saved, with Retry.
      job.tries = (job.tries ?? 0) + 1;
      if (!isOffline(e) && job.type === 'add' && job.tries >= 3) job.failed = `${e instanceof Error ? e.message : String(e)}`;
      keepQueue();
      changed();
      return;
    }
    sending = null;
    if (answer.data?.rows) {
      applyRows(answer.data.rows);
      await db.saveRows(answer.data.rows);
    }
    const o = Outbox.outcome(job, answer);
    if (o.kind === 'saved' || o.kind === 'dropped') queue = queue.filter((j) => j.key !== job.key);
    else if (o.kind === 'resend') job.conflicts = (job.conflicts ?? 0) + 1;
    else job.failed = o.message;
    keepQueue();
    if (o.kind === 'dropped') {
      noticeListeners.forEach((fn) => fn(`Not saved: ${o.message}`));
      refresh().catch(() => { /* shown in the header */ });
    }
    showQueued();
    changed();
  }
}

// ---- Refreshing ----

/** @type {Promise<void>|null} */
let running = null;

/** Fetches everything from the server. One at a time: a call while one runs shares it. @returns {Promise<void>} */
export function refresh() {
  if (!running) running = run().finally(() => { running = null; });
  return running;
}

async function run() {
  savedSincePull = [];
  status.refreshing = true;
  changed();
  try {
    const r = await call('sync.pull', {});
    if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
    const pulled = r.data;
    replaceAll(pulled);
    // Saves answered while this refresh was on its way are newer than what it read: keep them.
    for (const { table, row } of savedSincePull) {
      const now = /** @type {any} */ (data[table])[row[ID_FIELD[table]]];
      if (!now || now.version < row.version) /** @type {any} */ (data[table])[row[ID_FIELD[table]]] = row;
    }
    showQueued();
    await db.saveRows(pulled, { replace: true });
    Object.assign(status, { user: pulled.user, users: pulled.users, sheetUrl: pulled.sheet_url, lastSynced: Date.now(), error: null, online: true, timing: { ...lastTiming } });
    await db.setMeta({ user: status.user, users: status.users, lastSynced: status.lastSynced, sheetUrl: status.sheetUrl });
    flush();
  } catch (e) {
    status.online = !isOffline(e);
    status.error = status.online ? (e instanceof Error ? e.message : String(e)) : null;
    throw e;
  } finally {
    status.refreshing = false;
    savedSincePull = [];
    changed();
  }
}

/** Forgets everything on this phone (signing out). */
export async function forget() {
  await db.clearAll();
  queue = [];
  keepQueue();
  for (const table of TABLES) /** @type {any} */ (data)[table] = {};
  Object.assign(status, { user: '', users: [], lastSynced: null, error: null, sheetUrl: null });
  changed();
}

/** Keeps the copy current: when the connection returns, when the app is reopened, and every five minutes. */
export function keepInStep() {
  sendingAllowed = true;
  flush();
  const attempt = () => { if (navigator.onLine) { flush(); refresh().catch(() => { /* shown in the header */ }); } };
  window.addEventListener('online', () => { status.online = true; attempt(); });
  window.addEventListener('offline', () => { status.online = false; changed(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') attempt(); });
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - (status.lastSynced ?? 0) > 300000) attempt();
  }, 60000);
}
