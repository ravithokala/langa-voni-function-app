// @ts-check

/**
 * Where the app finds its server and which Google sign-in client it is. Both are public by
 * nature: the server refuses every request without a listed user's Google sign-in.
 * The sign-in client is the one every app on ravithokala.github.io shares.
 */
export const CONFIG = Object.freeze({
  /** The Apps Script API deployment's URL, ending /exec. */
  apiUrl: 'https://script.google.com/macros/s/AKfycbzscsYa-N-XCtEgsnMSJD9nOk5INDeMQ227XYKy_8aq4jSawN8bBtkMoQrrdRyFCibLuw/exec',
  /** The OAuth client ID from Google Cloud, ending .apps.googleusercontent.com. */
  clientId: '558653473092-ltcjl3vevvo8is49of49hovo7tcsshho.apps.googleusercontent.com',
  /** Prefix of this app's localStorage keys: the apps share one origin (github.io). */
  storage: 'lv',
  /** What kind each action is (app-kit's api.js): reads wait 45 s and are tried twice; slow take one long try; the rest are saves. */
  waits: Object.freeze({ reads: Object.freeze(['sync.pull', 'system.check']), slow: Object.freeze([]) }),
});
