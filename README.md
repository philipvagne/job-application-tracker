# Job Application Tracker

Working title. A free browser app for tracking job applications: paste a link, choose the CV you sent, and keep a reliable record of what you sent and said to each employer. There are no accounts and no server. Everything stays on your own device.

Live: https://job-application-tracker.philipv-agne.workers.dev. The address is public, but the site asks search engines not to list it (`X-Robots-Tag: noindex`).

## Privacy

The app itself makes no network requests at all (its content security policy forbids them): no analytics, no tracking, no fonts or scripts from other sites. Your applications are stored in the browser (localStorage), and your CV files in the browser's IndexedDB. "Delete all my data" in the settings removes everything, including the files. Links you save are only shown as text, and opened in a new tab when you click them. The one exception is outside the app: on a Platsbanken ad page the bookmarklet asks Arbetsförmedlingen's open API for that ad (see "The bookmarklet").

## Run it

You need Node.js 24 (see `.node-version`).

```
npm install
npm run dev        # development server
npm test           # language-file check and unit tests
npm run build      # checks, type-check and production build into dist/
npm run preview    # serves dist/ with the same security headers as the live site
```

## Prefilling a job from the address (for the bookmarklet, and for testing)

Opening the app with `/#add=1&v=1&bv=3&u=<link>&jo=<company>&jt=<role>` (values URL-encoded) fills the quick-add card; nothing is saved until you press save. Only `u` is required and must be an http(s) link; `v` must be `1`; `jo` and `jt` are cut at 200 characters; `oc` and `dl`, which version 2 bookmarks still send, are ignored; `bv` is the bookmark version (a missing or older one makes the card say the bookmark should be made again); `dt` (page title) is accepted but not used yet. HTML tags in `jo` and `jt` are removed and entities decoded once. The fragment is removed from the address after it has been read. The bookmarklet that sends this is described in the next section.

## The bookmarklet

The side column has "Add from a job ad". The dialog explains in plain words why and how (the technical details are behind a collapsed "More information" section), and shows a link to drag to the bookmarks bar, and a "copy bookmark code" button for making the bookmark by hand (the way if you use the keyboard). The bookmark is made for the address the app is opened from, so one made on `localhost` only works while the app runs there. The code is built in `src/domain/bookmarkletSource.ts`.

**What it does.** Clicked on a job page, it opens this app in a new tab with the address described above. The card is filled in and you check it and save yourself.

**What it reads.** It runs a short list of adapters, each filling only what is still empty. (1) On a Platsbanken ad page (`arbetsformedlingen.se/platsbanken/annonser/<digits>`) it asks Arbetsförmedlingen's open JobTech API for the ad and reads only the company (`employer.name`) and the occupation (`occupation.label`), which becomes the role; the ad's own title, its deadline and everything else are not read, and nothing is put in the notes. The saved link is the clean ad address. On such a page the structured-data adapter below is skipped, so the role can only be the occupation (empty if the ad has none). (2) The `title` and company of a `JobPosting` block in the page's structured data (`application/ld+json`). (3) The page title. It does not guess a job title or company from the page title or the page text. On LinkedIn and many other sites only the link comes along.

**Where the Platsbanken data comes from.** Arbetsförmedlingen's open JobTech JobSearch API (`https://jobsearch.api.jobtechdev.se/ad/<id>`). The request is made by the bookmark, from the Platsbanken page you are on, with no cookies and no referrer, and gives up after 2.5 seconds; the app itself still makes no network requests. If the request fails, only the link and page title are sent. The ad is saved as a note, never automatically. See `docs/DATA_SOURCES.md`; the terms of use still need to be checked before the app is promoted publicly.

**What it never does.** No network request except the one to the JobTech API on a Platsbanken ad page, no cookies or storage, no reading of the page text, no changes to the page (see the next paragraph for the one box), and nothing is saved until you press save. On a page that is not http(s) it opens nothing. The new tab is opened without a link back to the page (`noopener,noreferrer`). A browser only lets a bookmark open a tab for a few seconds after the click, which is why the wait for the API is limited to 2.5 seconds. If the click has run out anyway, the bookmark shows a small box in the corner of the page with a link to the tracker (and a close button) instead of opening it; nothing else on the page is touched.

**Bookmark version.** The current version is 3 (shown in the dialog). A bookmark made before version 3 still works, but a version 2 one puts the ad headline in the role, and the quick-add card says so when a job arrives from an older bookmark. A tracker that gets a version 2 address ignores its `oc` and `dl`, uses its `jt` as the role and leaves the notes empty. Make it again from "Add from a job ad" to update; the tracker is kept up to date, the bookmark only changes when it has to. The version is one constant, `CURRENT_BOOKMARK_VERSION` in `src/domain/addPayload.ts`, used by the bookmark builder, the tracker and the dialog, so a future version changes one line. Because the app cannot read browser bookmarks, it notices an old one in two ways: a job arriving from an old bookmark shows a red notice with a "Make a new bookmark" button, and the version of the bookmark last used is remembered in the interface preferences (`jobtracker:v1:ui`, key `lastBookmarkVersion`; not part of exports or backups, removed by "Delete all my data"). While that version is older than the current one, the dialog shows a red line at the top; it goes away the first time a new bookmark is used. Someone who has never used a bookmark sees no warning.

**Known limits.** Some sites block bookmarklets with a strict content security policy, and some pages have no structured job data (then only the link comes along). If a job ad sits in a frame from another site, the bookmarklet sees the outer page. Very long text is cut. If the app address changes, the bookmark has to be made again.

## Deploy (Cloudflare Workers, static assets)

The app is a static site, deployed as a Cloudflare Workers project that serves the `dist/` folder (see `wrangler.jsonc`; there is no Worker code). In the Cloudflare dashboard choose Workers & Pages, Create application, connect the GitHub repository, and enter:

| Setting | Value |
| --- | --- |
| Project name | `job-application-tracker` (must match `name` in `wrangler.jsonc`) |
| Build command | `npm test && npm run build` |
| Deploy command | `npx wrangler deploy` (the default) |
| Root directory | (empty) |
| Build variables | none; the Node version comes from `.node-version` |

Every push to `main` builds and deploys. Security headers, caching and the "do not index" header come from `public/_headers`, which is copied into `dist/` by the build. To let search engines list the site later, delete the `X-Robots-Tag` block in that file. The `noindex` header keeps the site out of search results but does not hide it: anyone with the address can open it, and `workers.dev` addresses (including preview addresses) are public.

**Your data lives in one browser at one address.** The browser keeps data separately for each address, so `localhost` and the live address do not share anything, and neither do two different browsers. To move your data, use Export in the settings on the old address and Import on the new one. The backup does not contain the CV files yet, so keep your original PDFs and upload them again if needed.
