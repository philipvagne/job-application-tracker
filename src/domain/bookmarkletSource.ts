import { CURRENT_BOOKMARK_VERSION } from './addPayload'
import { isHttpUrl } from './url'

/**
 * The code the bookmarklet runs on a job page. It is deliberately dumb: a short list of adapters
 * each collect raw candidates (Platsbanken's own data, the company named in a JobPosting
 * block) into the fields, and the tracker is opened with them in the address fragment. The tracker cleans and checks everything (see readAddHash). Nothing on the page is
 * changed and nothing is saved.
 *
 * The one network request: on a Platsbanken ad page (arbetsformedlingen.se/platsbanken/annonser/<digits>)
 * the Platsbanken adapter asks Arbetsförmedlingen's open JobTech API for that ad, and reads only
 * employer.name (the company) and occupation.label (the role; never the ad's headline). It gives up
 * after 2500 ms (the browser only allows opening a tab for a few seconds after the click), and on
 * any problem only the link is sent. Nothing from the page is sent.
 *
 * The same rule on every site: the link always, the company when the page states it, and the role
 * only on Platsbanken (the occupation). No page title, job title or other text of the page is read
 * as a role, because no code can tell a slogan from a role.
 *
 * Adapters fill only fields that are still empty, in this order: Platsbanken, JSON-LD (the company
 * only). On a Platsbanken ad page the JSON-LD adapter is skipped. A new site is a new function in
 * that list.
 *
 * Handwritten ES5, because it runs inside other people's pages. '__APP__' is replaced by the
 * tracker's address, '__OPEN__' and '__CLOSE__' by the words of the fallback box. Keep every
 * statement ending in a semicolon: line breaks are removed.
 * The numbers: 300 characters per text field, 2048 for the link (the tracker's limit), and 7500
 * for the whole fragment (the tracker refuses more than 8192).
 */
const SOURCE = String.raw`(function () {
  var APP = '__APP__';
  var API = 'https://jobsearch.api.jobtechdev.se/ad/';
  var BOARD = 'https://arbetsformedlingen.se/platsbanken/annonser/';
  var BV = ${CURRENT_BOOKMARK_VERSION};
  var href = String(location.href).split('#')[0];
  if (!/^https?:\/\//i.test(href)) return;
  if (href.length > 2048) href = location.origin + location.pathname;
  if (href.length > 2048) return;
  var fields = { jt: '', jo: '' }, onAd = false;
  function fill(name, value) {
    if (!fields[name] && value) fields[name] = value;
  }
  function clip(s, n) {
    if (typeof s !== 'string') return '';
    s = s.replace(/\s+/g, ' ').replace(/^ | $/g, '');
    if (s.length > n) {
      s = s.slice(0, n);
      if (/[\ud800-\udbff]$/.test(s)) s = s.slice(0, -1);
    }
    return s;
  }
  function enc(s) {
    try { return encodeURIComponent(s); } catch (e) { return ''; }
  }
  function platsbanken(next) {
    var m = /^\/platsbanken\/annonser\/(\d{1,12})\/?$/.exec(location.pathname);
    if (!m || !/^https:/i.test(href) || !/^(www\.)?arbetsformedlingen\.se$/i.test(location.hostname)) return next();
    href = BOARD + m[1];
    onAd = true;
    var over = false, timer, ctl = null;
    function end() {
      if (over) return;
      over = true;
      clearTimeout(timer);
      try { next(); } catch (e) {}
    }
    function read(text) {
      var j;
      if (text.length > 1000000) return;
      j = JSON.parse(text);
      if (!j || typeof j !== 'object') return;
      fill('jo', j.employer && typeof j.employer === 'object' ? clip(j.employer.name, 300) : '');
      fill('jt', j.occupation && typeof j.occupation === 'object' ? clip(j.occupation.label, 300) : '');
    }
    try {
      if (typeof fetch !== 'function') return end();
      if (typeof AbortController === 'function') ctl = new AbortController();
      timer = setTimeout(function () {
        try { if (ctl) ctl.abort(); } catch (e) {}
        end();
      }, 2500);
      fetch(API + m[1], { credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined })
        .then(function (res) {
          if (res.status !== 200) throw 0;
          return res.text();
        })
        .then(function (text) {
          try { read(text); } catch (e) {}
          end();
        })
        .catch(end);
    } catch (e) {
      end();
    }
  }
  function isJob(o) {
    var t = o['@type'], i;
    if (typeof t === 'string') t = [t];
    if (!Array.isArray(t)) return false;
    for (i = 0; i < t.length; i++) {
      if (typeof t[i] === 'string' && /(^|[\/#:])JobPosting$/.test(t[i])) return true;
    }
    return false;
  }
  function find(v, depth) {
    var i, r;
    if (!v || typeof v !== 'object' || depth > 4) return null;
    if (Array.isArray(v)) {
      for (i = 0; i < v.length && i < 50; i++) {
        r = find(v[i], depth + 1);
        if (r) return r;
      }
      return null;
    }
    return isJob(v) ? v : find(v['@graph'], depth + 1);
  }
  function orgName(o) {
    if (Array.isArray(o)) o = o[0];
    if (typeof o === 'string') return o;
    return o && typeof o === 'object' ? o.name : '';
  }
  function jsonld(next) {
    if (onAd) return next();
    var blocks = document.querySelectorAll('script[type="application/ld+json"]');
    var job = null, i, text;
    for (i = 0; i < blocks.length && !job; i++) {
      try {
        text = blocks[i].textContent;
        if (text.length < 500000) job = find(JSON.parse(text), 0);
      } catch (e) {}
    }
    if (job) fill('jo', clip(orgName(job.hiringOrganization), 300));
    next();
  }
  function box(url) {
    var old = document.getElementById('jat-open'), d = document.createElement('div'), a = document.createElement('a'), b = document.createElement('button');
    function gone() {
      if (d.parentNode) d.parentNode.removeChild(d);
    }
    if (old && old.parentNode) old.parentNode.removeChild(old);
    d.id = 'jat-open';
    d.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px;padding:12px 14px;background:#fff;color:#111;border:2px solid #111;font:16px system-ui,sans-serif';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = '__OPEN__';
    a.style.marginRight = '12px';
    a.onclick = function () { setTimeout(gone, 0); };
    b.type = 'button';
    b.textContent = '__CLOSE__';
    b.onclick = gone;
    d.appendChild(a);
    d.appendChild(b);
    document.body.appendChild(d);
    a.focus();
  }
  function finish() {
    var u = enc(href), hash, order = ['jt', 'jo'], i, e, ua;
    if (!u) return;
    hash = '#add=1&v=1&bv=' + BV + '&u=' + u;
    for (i = 0; i < order.length; i++) {
      e = enc(fields[order[i]]);
      if (e && hash.length + e.length + 4 <= 7500) hash += '&' + order[i] + '=' + e;
    }
    ua = typeof navigator === 'object' && navigator ? navigator.userActivation : null;
    if (ua && ua.isActive === false) return box(APP + hash);
    window.open(APP + hash, '_blank', 'noopener,noreferrer');
  }
  var adapters = [platsbanken, jsonld];
  function step(i) {
    var called = false;
    function next() {
      if (called) return;
      called = true;
      step(i + 1);
    }
    if (i >= adapters.length) return finish();
    try { adapters[i](next); } catch (e) { next(); }
  }
  step(0);
})();`

/** The words in the box that appears when the browser would not open the tab by itself. */
export interface BookmarkletLabels {
  /** The link that opens the tracker. */
  open: string
  /** The button that closes the box. */
  close: string
}

/**
 * The `javascript:` address to drag to the bookmarks bar, opening `appUrl` (an http(s) address)
 * with the job. `labels` are the words of the fallback box, in the language the bookmark is made in.
 * `void` stops the page from being replaced by a return value. Null for an address that is not
 * http(s), such as a page opened from a file.
 */
export function buildBookmarklet(appUrl: string, labels: BookmarkletLabels): string | null {
  if (!isHttpUrl(appUrl)) return null
  const code = SOURCE.replace("'__APP__'", () => JSON.stringify(appUrl))
    .replace("'__OPEN__'", () => JSON.stringify(labels.open))
    .replace("'__CLOSE__'", () => JSON.stringify(labels.close))
    .split('\n')
    .map((line) => line.trim())
    .join('')
    .replace(/;$/, '')
  // Spaces, quotes and brackets are escaped so the link survives being dragged; browsers undo this when it runs.
  return 'javascript:void' + encodeURI(code).replace(/#/g, '%23')
}

/** True for an address on this computer (localhost, 127.x, ::1): a bookmarklet made there only works while the app runs there. */
export function isLocalAddress(appUrl: string): boolean {
  let host: string
  try {
    host = new URL(appUrl).hostname.toLowerCase()
  } catch {
    return false
  }
  return host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
}
