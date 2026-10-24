# Deploying without stale versions

How the app makes sure phones open the latest build, and the one-time server
change it needs.

## Why some phones kept showing an old version

nginx serves the built files with a `Last-Modified` date but no
`Cache-Control` header. Without that header, browsers guess how long a file
stays fresh: about 10% of its age. A build from three days ago could be reused
for roughly seven hours without asking the server, so opening the installed
app showed the old page and old bundles. A manual refresh always asks the
server, which is why refreshing fixed it every time.

Uninstalling the app or clearing its data on Android doesn't help, because the
installed app is a thin shell around Chrome. The cached files live in Chrome's
storage for the site.

## What the app does now

- **The service worker** (`apps/web/public/sw.js`) checks the page with the
  server every time the app opens. Unchanged pages cost a tiny "not modified"
  reply.
- **Each build has an ID.** It's the git commit plus the build time,
  published as `/version.json` and baked into the bundle (`apps/web/vite.config.ts`).
- **The app compares the two** (`apps/web/src/shared/lib/appUpdate.ts`): on start, whenever it comes
  back into view, and every 10 minutes while open.
  - **Just opened** (first 10 seconds, nothing tapped yet): it reloads into the
    new version silently, at most once per version.
  - **Already in use:** it shows "A new version of Verdict is ready" with a
    **Refresh** button.
- **If a deploy removed a code chunk** the open app still needed, the app
  reloads instead of showing an error.

## One-time server change (nginx)

The steps above work on their own, but the headers stop the browser guessing
in the first place.

1. **Check the current headers** (from any computer):

   ```bash
   curl -sI https://kishandoshi.me/ | grep -i -E "cache-control|last-modified"
   ```

   If there's a `Last-Modified` line but no `Cache-Control`, this change is
   needed.

2. **SSH into the server and open the site config:**

   ```bash
   ls /etc/nginx/sites-enabled/          # find the file for the app
   sudo nano /etc/nginx/sites-available/<your-site>
   ```

3. **Paste in the rules.** Inside the app's `server { ... }` block, replace the
   existing `location / { ... }` with the three location blocks from
   [`deploy/nginx/verdict-cache.conf`](../deploy/nginx/verdict-cache.conf).
   Keep `root` pointing at `apps/web/dist` as it does today.

   If the server block has other `add_header` lines (for example security
   headers), copy them into each new location too. nginx drops server-level
   headers inside a location that sets its own.

4. **Test and reload.** This doesn't drop connections, and no rebuild is needed:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. **Check again.** Run the curl from step 1. It should now show
   `Cache-Control: no-cache`. A bundle under `/assets/` should show
   `public, max-age=31536000, immutable`.

Deploys stay the same: `git pull && npm run build`.

## Phones that already have an old copy

Once the new build is live, opening the app (or one refresh) picks up the new
page, and from then on it updates itself. If a phone still shows an old
version after that, clear Chrome's data for the site:

Chrome → Settings → Site settings → All sites → kishandoshi.me →
**Delete data & reset permissions**, then open the app again.

This also turns off push notifications on that phone; switch them back on from
the room menu.

## Later: smoother deploys (free, not set up yet)

- **Build next to the live folder, then swap.** Today `npm run build` empties
  `dist/` while it rebuilds, so for a few seconds the site has no files. Building
  into a separate folder and then renaming it over `dist/` (or switching a
  symlink) avoids that gap.
- **Deploy on push.** A GitHub Actions workflow (free for this size) can SSH into
  the server and run the same `git pull && npm ci && npm run build` whenever
  master changes.
