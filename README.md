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
