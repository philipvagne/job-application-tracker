import { isHttpUrl } from './url'

/**
 * The code the bookmarklet runs on a job page. It is deliberately dumb: it collects raw candidates
 * (the link, the title and company of a JobPosting block, the page title) and opens the tracker
 * with them in the address fragment. The tracker cleans and checks everything (see readAddHash).
 * Nothing is fetched, nothing on the page is changed, and nothing is saved.
 *
 * Handwritten ES5, because it runs inside other people's pages. `'__APP__'` is replaced by the
 * tracker's address. Keep every statement ending in a semicolon: line breaks are removed.
 * The numbers: 300 characters per text field, 2048 for the link (the tracker's limit), and 7500
 * for the whole fragment (the tracker refuses more than 8192).
 */
const SOURCE = String.raw`(function () {
  var APP = '__APP__';
  var href = String(location.href).split('#')[0];
  if (!/^https?:\/\//i.test(href)) return;
  if (href.length > 2048) href = location.origin + location.pathname;
  if (href.length > 2048) return;
  function clip(s, n) {
    if (typeof s !== 'string') return '';
    s = s.replace(/\s+/g, ' ').replace(/^ | $/g, '');
    if (s.length > n) {
      s = s.slice(0, n);
      if (/[\ud800-\udbff]$/.test(s)) s = s.slice(0, -1);
    }
    return s;
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
  function enc(s) {
    try { return encodeURIComponent(s); } catch (e) { return ''; }
  }
  var blocks = document.querySelectorAll('script[type="application/ld+json"]');
  var job = null, i, text, meta;
  for (i = 0; i < blocks.length && !job; i++) {
    try {
      text = blocks[i].textContent;
      if (text.length < 500000) job = find(JSON.parse(text), 0);
    } catch (e) {}
  }
  meta = document.querySelector('meta[property="og:title"]');
  var fields = [
    ['jt', job ? clip(job.title, 300) : ''],
    ['jo', job ? clip(orgName(job.hiringOrganization), 300) : ''],
    ['dt', clip(document.title, 300) || clip(meta && meta.getAttribute('content'), 300)]
  ];
  var u = enc(href);
  if (!u) return;
  var hash = '#add=1&v=1&u=' + u, e;
  for (i = 0; i < fields.length; i++) {
    e = enc(fields[i][1]);
    if (e && hash.length + e.length + 4 <= 7500) hash += '&' + fields[i][0] + '=' + e;
  }
  window.open(APP + hash, '_blank', 'noopener,noreferrer');
})();`

/**
 * The `javascript:` address to drag to the bookmarks bar, opening `appUrl` (an http(s) address)
 * with the job. `void` stops the page from being replaced by a return value. Null for an address
 * that is not http(s), such as a page opened from a file.
 */
export function buildBookmarklet(appUrl: string): string | null {
  if (!isHttpUrl(appUrl)) return null
  const code = SOURCE.replace("'__APP__'", () => JSON.stringify(appUrl))
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
