# Deployment

How MeeronBi runs in production, how code gets there, and how to provision a
new instance.

Related: `docs/TESTING.md` (what CI verifies before anything ships),
`docs/RUNBOOK.md` (what to do when something fails), `docs/OPERATIONS.md`
(backup and restore policy).

## Overview

| | |
|---|---|
| **Compute** | One DigitalOcean Droplet (Ubuntu 24.04 LTS), Next.js under `pm2`, nginx in front for TLS |
| **Database** | DigitalOcean Managed MySQL 8.4 (Standard) — not self-hosted, per `docs/OPERATIONS.md` |
| **DNS/TLS** | `eikhoi.net` at GoDaddy; Let's Encrypt via certbot |
| **CI/CD** | GitHub Actions — `.github/workflows/ci.yml` gates, `deploy.yml` ships |
| **Current instance** | `meeronbi-test.eikhoi.net` (pilot) |

Deployment is **continuous and automated**. A push to `main` that passes CI
deploys itself; a release that fails its health check rolls back without
intervention. Nothing is built or installed on the server by hand.

## Deploying

### Normal deploy

Merge to `main`. That is the whole procedure.

CI runs (lint, typecheck, unit tests, migrations against a throwaway MySQL,
production build, boot, smoke test, security scans). On success, `deploy.yml`
deploys **the exact commit CI tested** — not whatever `main` has moved on to.

Watch Actions → Deploy for `healthy after Ns` and `Smoke: all passed`.

### Rollback

Actions → **Deploy** → **Run workflow** → tick *"Ignore 'sha' and flip the
server back to the previous release"*.

This flips a symlink and reloads pm2 — seconds, no rebuild. Deploying
*forward* again rebuilds, so only the rollback direction is instant.

Rollback also happens automatically whenever a new release fails its health
check or smoke test.

> **Rollback restores code, not the database.** `prisma migrate deploy` runs
> before the symlink flip and Prisma has no down-migrations, so a rolled-back
> release runs against the newer schema. Every migration must be
> backward-compatible with the release before it: add columns rather than
> dropping or renaming them in the same deploy that starts using them, and
> split a destructive change across two deploys (stop using it, ship, then
> drop it).

### Deploying a specific commit

Actions → Deploy → Run workflow → enter the SHA. It must already have passed
CI.

### From the server, if GitHub Actions is unavailable

```bash
sudo -iu deploy
bash /var/www/meeronbi/current/scripts/deploy.sh <git-sha>
bash /var/www/meeronbi/current/scripts/deploy.sh --rollback
```

## Server layout

Everything under `/var/www/meeronbi` is owned by the `deploy` user. The app
runs under **deploy's** pm2 daemon — pm2 is per-user, and root's daemon is
deliberately empty.

```
/var/www/meeronbi/
  repo/              bare git mirror, fetched with deploy's read-only key
  releases/<sha>/    one extracted, built release (last 5 kept)
  shared/.env        the one real .env, symlinked into every release
  shared/logs/       pm2 logs, so they survive release pruning
  current -> releases/<sha>     what pm2 serves
```

`scripts/deploy.sh` builds a new release in full while the previous one keeps
serving, then flips `current` and reloads pm2. The flip is a `rename(2)` over
the existing symlink, so there is no moment where `current` is missing.

pm2 runs in fork mode, so a reload is a restart: expect a **1–2 second blip**,
not zero downtime.

## Provisioning a new instance

For a new facility or a replacement box. Takes about an hour, mostly waiting.

### 1. Prerequisites

**Droplet** — Ubuntu 24.04 LTS, region closest to users, SSH-key-only auth.
**2 vCPU / 4 GB RAM.** A 1 vCPU / 2 GB box is not enough. If RAM is tight, add
swap before the first build:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**Managed MySQL** — engine MySQL 8.4, **Standard** edition (Advanced is for
multi-region HA, not needed at this scale), same region as the Droplet.

### 2. Base server

```bash
apt update && apt upgrade -y        # reboot if a new kernel lands

ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -   # matches CI
apt-get install -y nodejs nginx certbot python3-certbot-nginx
npm install -g pm2
```

Confirm password auth over SSH is off — it may be on if a root password was
ever set via the provider's console:

```bash
grep -i "^PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf
echo "PasswordAuthentication no" > /etc/ssh/sshd_config.d/99-disable-password-auth.conf
systemctl restart ssh
```

Verify key login still works in a **second** terminal before closing the first.

### 3. Deploy user and GitHub access

```bash
adduser --disabled-password --gecos "" deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
mkdir -p /var/www/meeronbi && chown -R deploy:deploy /var/www/meeronbi
```

Generate the repo deploy key **as deploy** — `sudo -iu deploy` is a login
shell, which plain `sudo -u deploy` is not, so `HOME` resolves to
`/home/deploy` and ssh/pm2 look in the right place:

```bash
sudo -iu deploy
ssh-keygen -t ed25519 -C "meeronbi-deploy" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

Add that public key under repo → **Settings → Deploy keys**, with *Allow write
access* **unchecked**. Then, still as deploy:

```bash
cat >> ~/.ssh/config << 'EOF'

Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

ssh -T git@github.com    # must print "Hi <owner>/<repo>!"
```

Do not continue until that authenticates.

### 4. Database

In the MySQL cluster's **Users & Databases**, create a dedicated database and
user (`meeronbi_db` / `meeronbi_db_user`) — do not reuse the cluster's
`defaultdb` or admin user.

Under **Settings → Trusted Sources**, add the Droplet. Managed databases
reject all connections, including from your own infrastructure, until this is
set.

Install the cluster's CA certificate root-owned, outside the app directory:

```bash
mkdir -p /etc/meeronbi
mv ca-certificate.crt /etc/meeronbi/ca-certificate.crt
chmod 644 /etc/meeronbi/ca-certificate.crt
```

Build `DATABASE_URL` from the cluster's **private network** connection string.
`ssl-mode` is a `mysql` CLI flag, not a Prisma option — Prisma needs
`sslaccept`/`sslcert`:

```
mysql://meeronbi_db_user:<password>@private-<host>:25060/meeronbi_db?sslaccept=strict&sslcert=/etc/meeronbi/ca-certificate.crt
```

> Never set `DATABASE_URL` in `/etc/environment` or a shell profile. Process
> env silently overrides `.env`, and the app will connect to the wrong
> database. Verify with `env | grep DATABASE` (must print nothing).

### 5. Environment file

```bash
sudo -iu deploy
mkdir -p /var/www/meeronbi/shared/logs /var/www/meeronbi/releases
nano /var/www/meeronbi/shared/.env
chmod 600 /var/www/meeronbi/shared/.env
```

`0600` matters — this file holds the database password and session secret.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Private connection string from *Database* above |
| `NEXTAUTH_URL` | `https://` + this instance's domain |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` — never reused across instances |
| `NEXT_PUBLIC_APP_ORIGIN` | Same domain, no protocol or trailing slash |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Real credentials; placeholders only on a disposable instance |
| `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` | Same — this account crosses facility boundaries |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` | Outbound mail transport. Leaving `SMTP_HOST` blank makes the worker log every email to its own stdout instead of sending — fine for a disposable instance, not for production. |
| `EMAIL_FROM` | `"From"` header for outbound mail, e.g. `MeeronBi <no-reply@yourdomain>` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client credentials. Leaving either blank disables Google sign-in entirely — the buttons just don't render, credentials login is unaffected. |
| `SENTRY_DSN` | Real DSN, or blank (a safe no-op) |

> **Google sign-in setup.** In Google Cloud Console, create an OAuth 2.0
> Client ID (type: Web application) and register **both** authorized
> redirect URIs — one Google OAuth client backs two NextAuth provider ids,
> plain sign-in and sign-in-or-researcher-signup (see
> `src/domain/auth/googleSignIn.ts` and `src/server/auth/authOptions.ts`):
>
> ```
> https://<this instance's domain>/api/auth/callback/google
> https://<this instance's domain>/api/auth/callback/google-signup
> ```
>
> Google can only ever sign in to an account that already exists in this
> database (provisioned by a super admin or an existing patient/researcher
> login) — it can never mint an ADMIN or SUPER_ADMIN, and can only create a
> new account for researcher self-signup, same `PENDING`-approval path as
> credentials signup.

> **Provisioning a facility admin or a patient portal invite depends on
> `meeronbi-email-worker` being up** (see `ecosystem.config.cjs`) — both send
> a set-password link through the `email_outbox` table rather than a typed
> password, and nothing else drains that table. If the worker is down, a
> newly provisioned admin or invited patient gets no link and cannot sign in
> until it's running again and catches up.

### 6. First release

```bash
sudo -iu deploy
cd /var/www/meeronbi
git clone --bare git@github.com:varunbalaji167/MeeronBi.git repo
git -C repo show main:scripts/deploy.sh > ~/deploy-bootstrap.sh
bash ~/deploy-bootstrap.sh "$(git -C repo rev-parse main)"
pm2 save
exit

sudo -iu deploy pm2 startup    # run the line it prints, as root
```

`deploy.sh` installs, generates the Prisma client, applies migrations, builds,
flips the symlink, health-checks and smoke-tests. Allow 5–10 minutes.

**Seeding — disposable instances only.** `npm run seed` creates demo accounts
with shared passwords (`testing@123`, `ResearcherDemo123!`). For a real
deployment, skip it and create the first admin by hand; see `prisma/seed.ts`
for the shape expected.

### 7. nginx, DNS, TLS

`/etc/nginx/sites-available/meeronbi`:

```nginx
server {
    listen 80;
    server_name <subdomain>.eikhoi.net;

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
ln -s /etc/nginx/sites-available/meeronbi /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

> `X-Forwarded-For` is what `src/server/http/rateLimit.ts`'s `getClientIp()`
> reads. Without it every request appears to come from the same IP, silently
> disabling per-IP rate limiting.

DNS: add an **A record** in GoDaddy (**Domains → DNS**) pointing the subdomain
at the Droplet's IPv4. Verify with `dig +short <subdomain>.eikhoi.net @8.8.8.8`.

TLS, once DNS resolves:

```bash
certbot --nginx -d <subdomain>.eikhoi.net
```

Certbot adds HTTPS, redirects HTTP, and schedules its own renewal.

### 8. Go-live checklist

- [ ] `curl https://<domain>/api/health` → `{"status":"ok","checks":{"db":"ok"}}`
- [ ] `curl -I http://<domain>` redirects to `https://`
- [ ] All five security headers present, no `X-Powered-By`
- [ ] Browser login at `/login` reaches the dashboard
- [ ] `sudo pm2 list` is empty (app runs under `deploy`, not root)
- [ ] `shared/.env` is `0600`
- [ ] Demo seed passwords rotated or demo accounts removed
- [ ] `SENTRY_DSN` set, or deferred deliberately
- [ ] Backup retention confirmed per `docs/OPERATIONS.md` — the provider's
      automated backups/PITR cover most of this; confirm the window rather
      than assuming it

## Continuous deployment

`.github/workflows/deploy.yml` triggers on CI completing successfully on
`main`. It uses `workflow_run`, so the version of the workflow that executes
is always the one on the default branch — a pull request cannot modify the
deploy steps or reach the deploy secrets.

`scripts/deploy.sh` is piped over SSH from the commit being deployed, so the
server never holds a copy that can drift from the repo.

### Repository secrets

Settings → Secrets and variables → **Actions**. All five are *secrets*, not
variables — `deploy.yml` reads them via `secrets.*`, and a value added as a
variable resolves to an empty string.

| Secret | Value |
|---|---|
| `DEPLOY_SSH_KEY` | Private key for CI's SSH access, full file including BEGIN/END |
| `DEPLOY_HOST` | Server IP |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -t ed25519 <ip>` |
| `DEPLOY_PUBLIC_URL` | `https://<domain>` — optional; enables the external post-deploy check |

> Two different keys do two different jobs: `~deploy/.ssh/github_deploy` lets
> the **server pull from GitHub**; `DEPLOY_SSH_KEY` lets **GitHub Actions SSH
> into the server**. Neither substitutes for the other.

Generate CI's key on your laptop, not the server, so it is revocable
independently:

```bash
ssh-keygen -t ed25519 -C "meeronbi-github-actions" -f ~/.ssh/meeronbi_ci
```

`ssh-copy-id` will not work — `deploy` has no password. Install it via root:

```bash
sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys <<< "<public key line>"
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys
```

Verify with the exact command the workflow runs:

```bash
ssh -i ~/.ssh/meeronbi_ci -o BatchMode=yes deploy@<ip> "pm2 list"
```

`DEPLOY_KNOWN_HOSTS` pins the host key so the workflow never needs
`StrictHostKeyChecking=no`, which would hand the deploy key to anything
answering on that address.

### What a deploy does

1. CI passes on `main`.
2. `deploy.sh` fetches the commit, extracts it to `releases/<sha>`, installs,
   generates the Prisma client, applies migrations and builds — all while the
   previous release keeps serving.
3. `current` flips; pm2 reloads.
4. The release must answer `/api/health` with `"status":"ok"` and `"db":"ok"`,
   then pass `scripts/smoke.sh` (liveness, public pages, the auth boundary,
   security headers).
5. On failure of either, the symlink flips back, pm2 reloads the previous
   release, and the workflow fails.

A build failure is a non-event for users — it happens before the flip.

## Operations

```bash
# Logs
sudo -iu deploy pm2 logs meeronbi
tail -f /var/www/meeronbi/shared/logs/error.log

# Status, restart
sudo -iu deploy pm2 list
sudo -iu deploy pm2 restart meeronbi

# What is currently deployed
readlink /var/www/meeronbi/current
ls -1t /var/www/meeronbi/releases

# Probe a running instance (same script CI and deploy use)
bash /var/www/meeronbi/current/scripts/smoke.sh http://127.0.0.1:3000
```

Changing an environment variable means editing `shared/.env` and restarting —
it is shared across releases, so it survives deploys and rollbacks alike.
Values baked into the client bundle at build time (`NEXT_PUBLIC_*`) need a
redeploy, not a restart.

## Known issues

- **Next.js is pinned to 14.2.35, the final 14.x release.** No further 14.x
  security patches will be published. Ten open advisories (two critical) have
  no fix below `next@16`. Each is assessed against this app's configuration
  and accepted in `.github/audit-allowlist.json`, where every entry **expires
  2026-12-31** and then fails CI. The 14 → 16 upgrade needs its own planned
  pass; see `docs/SCALING_PLAN.md`.
- **Building while serving is memory-hungry.** A release builds alongside the
  running one. On a 4 GB box keep swap configured; if `npm run build` is
  OOM-killed mid-deploy, add swap before resizing.
- **The DB CA certificate can be rotated by the provider.** If connections
  suddenly fail with a certificate error, re-download it and replace
  `/etc/meeronbi/ca-certificate.crt`.
- **CloudPanel was evaluated and abandoned** — a reproducible Doctrine
  migration bug in CloudPanel 2.5.4 on Ubuntu 24.04 (`"no such table: site"`,
  independent of install flags). The manual nginx/certbot/pm2 setup here is
  the proven path.
