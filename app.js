// @ts-check

import { CONFIG } from './config.js';
import { init, session, signOutOfGoogle } from './auth.js';
import { sessionKey, signOut as endSession, signOutEverywhere as endEverySession } from './api.js';
import { el, $ } from './dom.js';
import * as store from './store/store.js';
import { updatedText } from './freshness.js';
import { VERSION } from './version.js';
import { watchForUpdates } from './update.js';
import { inFrame, FRAMED_MESSAGE } from './guard.js';
import { watchInstall } from './install.js';
import { onSessionEnded } from './api.js';
import { home } from './views/home.js';
import { guestsScreen } from './views/guests.js';
import { shoppingScreen } from './views/shopping.js';
import { budgetScreen } from './views/budget.js';
import { todoScreen } from './views/todo.js';
import { more } from './views/more.js';
import { toast } from './views/sheet.js';

/**
 * Langa Voni Function. Starts the app, signs in, loads this phone's copy, keeps it in step with the sheet, and sends
 * each address to its screen:
 *   #/home  days to go and everything at a glance    #/guests  families by city, informed and invited
 *   #/shopping/dresses  #/shopping/other  shopping and where each dress is
 *   #/budget  totals, advances and balances          #/todo  to-dos      #/more  the function, settings, backup
 */

const TABS = [['home', 'Home'], ['guests', 'Guests'], ['shopping', 'Shopping'], ['budget', 'Budget'], ['todo', 'To do'], ['more', 'More']];
const SCREENS = TABS.map(([id]) => id);

/** The screen and its argument from the address. */
function route() {
  const [screen = 'home', arg = ''] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { screen: SCREENS.includes(screen) ? screen : 'home', arg: decodeURIComponent(arg) };
}

let signedIn = false;

/** Draws the current screen. */
function show() {
  if (!signedIn) return;
  const { screen, arg } = route();
  const main = $('main');
  // A redraw (a save answered, a refresh) keeps what the quick boxes hold and where the cursor is, so typing goes on.
  const active = /** @type {HTMLInputElement|null} */ (document.activeElement instanceof HTMLInputElement && main.contains(document.activeElement) && document.activeElement.hasAttribute('data-keep') ? document.activeElement : null);
  const caret = active ? active.selectionStart : null;
  const drafts = new Map([...main.querySelectorAll('input[data-keep]')].map((i) => [i.id, /** @type {HTMLInputElement} */ (i).value]));
  if (screen === 'home') home(main);
  else if (screen === 'guests') guestsScreen(main);
  else if (screen === 'shopping') shoppingScreen(main, arg);
  else if (screen === 'budget') budgetScreen(main);
  else if (screen === 'todo') todoScreen(main);
  else more(main, { signOut, signOutEverywhere });
  for (const [id, value] of drafts) {
    const box = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
    if (box && value && !box.value) box.value = value;
  }
  if (active) {
    const box = /** @type {HTMLInputElement|null} */ (document.getElementById(active.id));
    if (box) { box.focus(); if (caret !== null) box.setSelectionRange(caret, caret); }
  }
  document.querySelectorAll('#tabs a').forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('data-tab') === screen)));
  showSyncState();
}

/**
 * The header's right: how fresh this phone's copy is ("09:14 ↻", tap to re-read the sheet), and
 * the badge: offline, or a problem.
 */
function showSyncState() {
  const updated = updatedText(store.status, Date.now());
  $('updated').textContent = updated.short;
  $('refresh').setAttribute('aria-label', updated.label);
  $('refresh').title = updated.label;
  $('refresh').hidden = false;
  const badge = $('sync');
  const s = store.status;
  const q = store.queued();
  // Changes kept on the phone (ADR-013): how many are waiting, or refused.
  const text = q.failed ? `${q.failed} not saved` : !s.online ? (q.waiting ? `Offline · ${q.waiting} to save` : 'Offline') : s.error ? 'Not updated' : q.waiting ? `Saving ${q.waiting}` : '';
  badge.textContent = text;
  badge.hidden = text === '';
  badge.className = `badge ${q.failed ? 'problem' : !s.online ? 'offline' : s.error ? 'problem' : q.waiting ? 'saving-badge' : 'busy'}`;
  badge.title = q.failed ? 'Some entries were not saved: look for Not saved, then Retry or Discard'
    : !s.online ? `Offline${q.waiting ? ': your changes are kept on this phone and saved when the connection returns' : ''}` : s.error ?? '';
}

/**
 * Ends this account's sign-in on every device (a lost phone), then clears this phone as signing
 * out does. Needs a connection: answers why it failed, or null.
 * @returns {Promise<string|null>}
 */
async function signOutEverywhere() {
  try {
    const r = await endEverySession();
    if (!r.ok) return r.errors.map((e) => e.message).join('; ');
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  await clearThisPhone();
  return null;
}

async function signOut() {
  const q = store.queued();
  if (q.waiting + q.failed > 0 && !window.confirm(`${q.waiting + q.failed} ${q.waiting + q.failed === 1 ? 'change has' : 'changes have'} not been saved yet and will be lost. Sign out anyway?`)) return;
  await endSession();
  await clearThisPhone();
}

async function clearThisPhone() {
  signOutOfGoogle();
  await store.forget();
  signedIn = false;
  window.location.hash = '#/home';
  window.location.reload();
}

/** @param {string} message */
function showError(message) {
  $('main').replaceChildren(el('p', { class: 'error' }, message));
}

async function start() {
  // GitHub Pages cannot forbid framing: refuse to run inside another page (app-kit's guard.js).
  if (inFrame()) { showError(FRAMED_MESSAGE); return; }
  // Chrome offers to install once, early: listen before anything else (app-kit's install.js).
  watchInstall();
  // When the server ends this phone's session (expired, "sign out all devices" elsewhere, or the account
  // no longer allowed), the saved copy goes too, and the app starts again at sign-in.
  onSessionEnded(async () => { await store.forget(); window.location.reload(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { /* works without it */ });
  // The app opens from its saved copy; a newer published version reloads the page into it,
  // never over an open form.
  const checkForUpdate = watchForUpdates({ running: VERSION, busy: () => Boolean(document.querySelector('dialog[open]')) });
  if (!CONFIG.apiUrl || !CONFIG.clientId) {
    showError('This app is not configured yet (config.js): see the README.');
    return;
  }

  $('tabs').replaceChildren(...TABS.map(([id, label]) => el('a', { href: `#/${id}`, 'data-tab': id }, label)));
  $('sync').addEventListener('click', () => { window.location.hash = '#/more'; });
  // Tapping the time and ↻ re-reads the sheet now (reads only), and checks for a newer version of the app.
  $('refresh').addEventListener('click', () => {
    checkForUpdate(true);
    if (signedIn) store.refresh().catch(() => { /* shown in the header */ });
  });
  window.addEventListener('hashchange', () => { show(); window.scrollTo(0, 0); });
  store.onChange(() => show());
  store.onNotice((text) => toast(text));

  let hasCopy = false;
  try {
    hasCopy = await store.load();
  } catch (e) {
    showError(`This phone's storage could not be opened: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  // A signed-in phone with a saved copy opens at once, even offline; Google is only needed to sign in.
  if (!session()) {
    if (!navigator.onLine) { showError('Connect to the internet to sign in the first time.'); return; }
    $('main').replaceChildren(el('p', { class: 'muted' }, 'Sign in with your Google account to use the app.'));
    try {
      await init(CONFIG.clientId, $('signin'));
      await sessionKey();
    } catch (e) {
      showError(`Could not sign in: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    $('signin').replaceChildren();
  } else {
    // Ready for when the session expires and Google is needed again.
    init(CONFIG.clientId, $('signin')).then(() => $('signin').replaceChildren()).catch(() => { /* offline: the saved session is used */ });
  }

  signedIn = true;
  if (hasCopy) show();
  else $('main').replaceChildren(el('p', { class: 'muted' }, 'Loading…'));
  store.keepInStep();
  try {
    await store.refresh();
  } catch (e) {
    if (!hasCopy) showError(store.status.online ? `Could not load: ${store.status.error}` : 'Offline: connect once to load the data.');
  }
  if (store.status.user) show();
}

start();
