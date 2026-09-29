# Deployment — how this gets wired up, once there's something to deploy to

Status: **written ahead of having any paid infrastructure.** No VPS, no
managed database, no CI/CD pipeline exists yet — only the domain
(`eikhoi.net`, registered at GoDaddy) is owned today. This doc exists so
that whenever that changes, deploying is following a checklist, not
re-deriving it from scratch. It has not been executed end-to-end against
a real server (no live box exists to test against) — read the caveats
inline rather than assuming every command has been run.

Related: `docs/OPERATIONS.md` covers backups/restore (a separate, still-
open decision); this file covers "how the app gets onto a server and
stays running," which is a prerequisite to that, not a replacement for it.

## 0. Why GoDaddy's current plan doesn't work here

The GoDaddy product on this account today is **Websites + Marketing
Free** — a drag-and-drop site builder. It cannot run a Node.js process
or give you a real MySQL connection string, so this app cannot be
deployed onto it, full stop. GoDaddy's *domain* (`eikhoi.net`) is still
useful — you'll point its DNS at wherever the app actually runs (step 4).
If a different GoDaddy product has since been purchased (a VPS or
dedicated server, specifically), skip to step 1 and treat it like any
other Linux box.

## 1. Pick where the app runs

Two realistic shapes; pick one deliberately rather than defaulting:

- **Option A — one small VPS (recommended starting point).** A single
  Ubuntu box (DigitalOcean/Linode/Hetzner-class, ~$6–12/mo) running
  Node.js, MySQL, and a reverse proxy. Full control, cheapest to start,
  matches the "simple now, easy to grow" call already made for the rate
  limiter. Steps 2–7 below assume this option.
- **Option B — split hosting.** App on a platform like Vercel (built for
  Next.js specifically) + a separate managed MySQL (see the shortlist in
  `docs/OPERATIONS.md` §(b)). Less server administration (no OS patching,
  no manually configuring nginx/PM2), but two accounts/bills to manage
  instead of one, and Vercel's serverless functions mean the in-memory
  rate limiter (`src/server/http/rateLimit.ts`) silently stops working
  correctly across cold starts/multiple instances — that's the documented
  Redis trigger (`docs/SCALING_PLAN.md` §3) arriving sooner than planned.
  Don't pick this option without also swapping the rate limiter.

The rest of this doc assumes **Option A**, since that's what the existing
foundation work (single-process rate limiter, `/api/health` for a load
balancer that doesn't exist yet) was built against. If you pick Option B
instead, revisit the rate limiter first.

## 2. Server prerequisites

On a fresh Ubuntu LTS box:

```bash
# Node.js 20.x (matches CI's node-version in .github/workflows/ci.yml)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL — only if self-hosting the DB here rather than using a managed
# provider (see docs/OPERATIONS.md §(b); managed is the recommended
# default, this repo's own "do not self-host MySQL" guidance applies).
sudo apt-get install -y mysql-server

# nginx (reverse proxy / TLS termination) + certbot (free HTTPS cert)
sudo apt-get install -y nginx certbot python3-certbot-nginx

# pm2 (keeps `next start` alive, restarts on crash and on reboot)
sudo npm install -g pm2
```

## 3. Get the code onto the server and configure it

```bash
git clone <this repo's URL> /var/www/meeronbi
cd /var/www/meeronbi
npm ci
cp .env.example .env
```

Edit `.env` — **every value in `.env.example` is a local-dev placeholder
and must be replaced before this is a production `.env`**, not just the
obviously-secret ones:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Real MySQL connection string (self-hosted or managed — see `docs/OPERATIONS.md` §(b)) |
| `NEXTAUTH_URL` | `https://` + the real domain, e.g. `https://eikhoi.net` |
| `NEXTAUTH_SECRET` | Freshly generated: `openssl rand -base64 32` — **never** the placeholder, never reused from `.env.example` or a dev `.env` |
| `NEXT_PUBLIC_APP_ORIGIN` | The real domain, no protocol/trailing slash, e.g. `eikhoi.net` — this narrows `next.config.mjs`'s Server Actions `allowedOrigins` away from localhost |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | A real admin login and a strong, unique password — not `testing@123` |
| `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` | Same — this account has cross-facility access |
| `SEED_DEMO_PATIENT_EMAIL` / `SEED_DEMO_PATIENT_PASSWORD` | Consider skipping the demo patient in production entirely (see below) rather than just renaming it |
| `SENTRY_DSN` | A real DSN from sentry.io, once that project exists — blank is a safe no-op if you're not ready for this yet |

**Do not run `npm run seed` as-is against production** — it's written for
demo/dev data (a fake patient, three demo researcher accounts with a
shared published password `ResearcherDemo123!`). Either skip seeding
entirely and create the first real admin account by hand (see
`prisma/seed.ts` for the exact shape it expects, and adapt), or edit a
copy of the seed script to create only the real accounts you need.

## 4. Point the domain here

In GoDaddy's DNS management for `eikhoi.net` (**Domains → Manage → DNS**):

- Add/edit an **A record**: host `@`, value = the server's public IPv4
  address.
- Add an **A record** for `www` too (or a `CNAME` to `@`), so both
  `eikhoi.net` and `www.eikhoi.net` resolve.
- DNS propagation can take anywhere from minutes to ~48 hours; don't
  assume a misconfiguration if it doesn't resolve instantly.

## 5. Database schema and build

```bash
npx prisma generate
npx prisma migrate deploy   # NOT `migrate dev` — that's interactive/dev-only
                             # and can prompt to reset data on drift.
                             # `deploy` applies pending migrations non-interactively.
npm run build
```

## 6. Run it, keep it running

```bash
pm2 start npm --name meeronbi -- start
pm2 save
pm2 startup   # prints a command to run once, so pm2 restarts the app on server reboot
```

`npm start` runs `next start`, which by default listens on port 3000 —
nginx (next step) is what actually faces the internet on 80/443.

## 7. Reverse proxy + HTTPS

```nginx
# /etc/nginx/sites-available/meeronbi
server {
    listen 80;
    server_name eikhoi.net www.eikhoi.net;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/meeronbi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d eikhoi.net -d www.eikhoi.net   # free TLS cert, auto-renews
```

The `X-Forwarded-For` header set above is what
`src/server/http/rateLimit.ts`'s `getClientIp()` already reads — without
it, every request behind this proxy would look like it came from the
same IP (`localhost`), silently breaking per-IP rate limiting. This is
the one line in the whole nginx config that this app's own code actually
depends on, not just a nginx-hygiene detail.

## 8. Post-deploy checklist

- [ ] `curl https://eikhoi.net/api/health` → `{"status":"ok",...}`, 200
- [ ] `curl -I https://eikhoi.net/` → all five security headers present
      (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
      `Permissions-Policy`, `Strict-Transport-Security`), no
      `X-Powered-By`
- [ ] Log in as the real admin account created in step 3 — confirm the
      demo/placeholder accounts either don't exist or aren't the ones
      being used
- [ ] `SENTRY_DSN` set (or explicitly deferred) — confirm a forced error
      shows up in Sentry if set
- [ ] Backups wired per `docs/OPERATIONS.md` — this doc gets the app
      running; it does not by itself make patient data recoverable
- [ ] `.env` file permissions restricted (not world-readable), and
      confirm it's in `.gitignore` (it already is) so it never gets
      committed

## 9. Updating the running app later

```bash
cd /var/www/meeronbi
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart meeronbi
```

## Status of this guide

This guide was written ahead of the first real deployment: every command
is derived from the documented behavior of Next.js, Prisma, pm2, nginx and
certbot, but the sequence has not yet been executed end to end against a
live server. Treat it as a reviewed first draft — sanity-check each step as
you go, especially version-specific flags, and correct this document as you
work through it.
