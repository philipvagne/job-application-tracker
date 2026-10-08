# Job Application Tracker

Working title. A free browser app for tracking job applications: paste a link, choose the CV you sent, and keep a reliable record of what you sent and said to each employer. There are no accounts and no server. Everything stays on your own device.

Live: https://job-application-tracker.philipv-agne.workers.dev. The address is public, but the site asks search engines not to list it (`X-Robots-Tag: noindex`).

## Privacy

The app makes no network requests at all: no analytics, no tracking, no fonts or scripts from other sites. Your applications are stored in the browser (localStorage), and your CV files in the browser's IndexedDB. "Delete all my data" in the settings removes everything, including the files. Links you save are only shown as text, and opened in a new tab when you click them.

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

Opening the app with `/#add=1&v=1&u=<link>&jo=<company>&jt=<role>` (values URL-encoded) fills the quick-add card; nothing is saved until you press save. Only `u` is required and must be an http(s) link; `v` must be `1`; `jo` and `jt` are cut at 200 characters; `dt` (page title) is accepted but not used yet. HTML tags in `jo` and `jt` are removed and entities decoded once. The fragment is removed from the address after it has been read. The bookmarklet that sends this is described in the next section.

## The bookmarklet

The side column has "Add from a job ad". It shows a link to drag to the bookmarks bar, and a "copy bookmark code" button for making the bookmark by hand (the way if you use the keyboard). The bookmark is made for the address the app is opened from, so one made on `localhost` only works while the app runs there. The code is built in `src/domain/bookmarkletSource.ts`.

**What it does.** Clicked on a job page, it opens this app in a new tab with the address described above. The card is filled in and you check it and save yourself.

**What it reads.** The page address (without its `#` part), the `title` and the company of a `JobPosting` block in the page's structured data (`application/ld+json`), and the page title. It does not guess a job title or company from the page title or the page text.

**What it never does.** No network requests, no changes to the page, no cookies or storage, no reading of the page text, and nothing is saved until you press save. On a page that is not http(s) it opens nothing. The new tab is opened without a link back to the page (`noopener,noreferrer`).

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
