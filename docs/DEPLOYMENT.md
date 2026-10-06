# Deployment — how this actually gets onto a server

Status: **executed and validated end-to-end** against a live DigitalOcean
Droplet (first instance: `meeronbi-test.eikhoi.net`, a test/pilot
deployment — substitute your own subdomain and credentials when repeating
this for another instance). Every command below was run for real, in this
order, and worked. This supersedes the earlier draft version of this file.

Related: `docs/OPERATIONS.md` covers backup/restore policy — a separate,
still-open decision. This file covers "how the app gets onto a server and
stays running."

## Architecture actually used

- **Compute**: one DigitalOcean Droplet (Ubuntu 24.04 LTS), running the
  Next.js app directly via `pm2` + an nginx reverse proxy. No control
  panel (CloudPanel was tried and abandoned due to a reproducible
  installer bug in that release — this is a plain, manually-configured
  box).
- **Database**: **DigitalOcean Managed MySQL** (MySQL 8.4, Standard
  Edition) — not self-hosted on the Droplet. This follows
  `docs/OPERATIONS.md`'s "do not self-host MySQL" guidance: the managed
  service handles backups/PITR, and the app server only needs to run
  Node.
- **DNS/registrar**: `eikhoi.net`, registered at GoDaddy. DNS records
  (A records) are managed directly in GoDaddy's DNS panel.

## 0. Prerequisites before starting

- A DigitalOcean account with a Droplet already created:
  - Ubuntu 24.04 LTS
  - Region: pick the one closest to your users (this instance used
    Bangalore / BLR1)
  - Size: **2 vCPU / 4GB RAM minimum.** A 1 vCPU/2GB box is not enough —
    it was tried first and ran out of memory running even basic services.
  - SSH-key-only authentication (see §1) — never password auth.
- A DigitalOcean Managed MySQL database cluster already created:
  - Engine: **MySQL 8.4** (confirm this explicitly — the product also
    offers Postgres/MongoDB/others)
  - Edition: **Standard** (not Advanced — Standard is correct for
    single-facility/pilot scale; Advanced is for real multi-region HA,
    not needed yet)
  - Same region as the Droplet (matters for latency and for using the
    private network path below)
  - A **dedicated database and user created for this app** (do not use
    the cluster's default `defaultdb`/admin user) — see §4.

## 1. SSH key setup

Generate a key pair on your own machine (never on the server, never
shared as a private key):

```bash
ssh-keygen -t ed25519 -C "<your-name>-meeronbi"
```
Accept the default file location. Get the public key:
```bash
cat ~/.ssh/id_ed25519.pub
```

Add that public key to the Droplet — either during Droplet creation
(DigitalOcean's "Add SSH Key" step), or afterwards by appending it to
`~/.ssh/authorized_keys` on the server (via DigitalOcean's web console if
you don't yet have SSH access, or via an existing admin's session):
```bash
mkdir -p ~/.ssh
echo "<the public key line>" >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Connect:
```bash
ssh root@<droplet-ip>
```

**Harden it once key access is confirmed working:** check whether
password auth is still enabled over SSH (it may be, if a root password
was ever set via DigitalOcean's "Reset Root Password" feature) and
disable it:
```bash
sudo grep -i "^PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null
# if it shows "yes" or nothing:
echo "PasswordAuthentication no" | sudo tee /etc/ssh/sshd_config.d/99-disable-password-auth.conf
sudo systemctl restart ssh
```
Confirm your key-based login still works in a **second** terminal before
closing the first, so you don't lock yourself out.

## 2. Base server setup

```bash
sudo apt update && sudo apt upgrade -y

# Firewall — SSH, HTTP, HTTPS only
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Node.js 20.x (matches CI's node-version in .github/workflows/ci.yml)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# nginx (reverse proxy / TLS termination) + certbot (free HTTPS cert)
sudo apt-get install -y nginx certbot python3-certbot-nginx

# pm2 (keeps `next start` alive, restarts on crash and on reboot)
sudo npm install -g pm2
```

If `apt update`/`upgrade` installs a new kernel, reboot before continuing
(`sudo reboot`, then reconnect via SSH) rather than leaving it pending.

## 3. Give the server access to the private GitHub repo

The repo is private, so the server needs its own **read-only deploy key**
— not a personal account's credentials, and not write access.

```bash
ssh-keygen -t ed25519 -C "meeronbi-droplet" -f ~/.ssh/meeronbi_deploy_key
cat ~/.ssh/meeronbi_deploy_key.pub
```

Add that public key on GitHub: repo → **Settings → Deploy keys → Add
deploy key** → paste it → **leave "Allow write access" unchecked.**

Tell the server's SSH client to use this specific key for GitHub:
```bash
cat >> ~/.ssh/config << 'EOF'

Host github.com
  IdentityFile ~/.ssh/meeronbi_deploy_key
  IdentitiesOnly yes
EOF
```

Verify, then clone:
```bash
ssh -T git@github.com   # expect: "Hi <repo>! ... does not provide shell access."
git clone git@github.com:<owner>/<repo>.git /var/www/meeronbi
```

## 4. Database — dedicated user, private connection string

On the Managed MySQL cluster, under **Users & Databases**, create (don't
reuse the default admin/`defaultdb`):
- A database, e.g. `meeronbi_db`
- A user scoped to it, e.g. `meeronbi_db_user`

Under **Settings → Trusted Sources**, add the Droplet explicitly —
managed databases reject all connections, even from your own
infrastructure, until this is done.

Under **Connection Details**, copy the **Private network** connection
string (same region as the Droplet routes over DigitalOcean's internal
network — faster and doesn't touch the public internet).

Download the cluster's **CA certificate** from the same page and install
it root-owned, outside the app directory (public cert, but it must not be
swappable):
```bash
# on your laptop
scp ~/Downloads/ca-certificate.crt root@<server-ip>:/tmp/
# on the server
mkdir -p /etc/meeronbi
mv /tmp/ca-certificate.crt /etc/meeronbi/ca-certificate.crt
chmod 644 /etc/meeronbi/ca-certificate.crt
```

Build the `DATABASE_URL` for Prisma from it. `ssl-mode` is a `mysql` CLI
flag, not a Prisma option — Prisma needs `sslaccept`/`sslcert`:
```
mysql://meeronbi_db_user:<password>@private-<cluster-host>:25060/meeronbi_db?sslaccept=strict&sslcert=/etc/meeronbi/ca-certificate.crt
```

Never set `DATABASE_URL` (or `DATABASE_*`) in `/etc/environment` or a shell
profile — process env silently overrides `.env`, and the app will connect
to the wrong database. Check with `env | grep DATABASE` (must print
nothing) and `pm2 env 0 | grep DATABASE`.

Test the connection directly before touching the app:
```bash
sudo apt install -y mysql-client-core-8.0
mysql -h private-<cluster-host> -P 25060 -u meeronbi_db_user -p meeronbi_db --ssl-mode=REQUIRED
```

## 5. Configure and build the app

```bash
cd /var/www/meeronbi
npm ci
nano .env
```

Fill in `.env` — every value here must be a real production value, not a
placeholder from `.env.example`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | The private connection string from §4 |
| `NEXTAUTH_URL` | `https://` + the subdomain this instance serves, e.g. `https://meeronbi-test.eikhoi.net` |
| `NEXTAUTH_SECRET` | Freshly generated: `openssl rand -base64 32` — never reused across instances |
| `NEXT_PUBLIC_APP_ORIGIN` | Same subdomain, no protocol/trailing slash, e.g. `meeronbi-test.eikhoi.net` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Real login + strong password for a real deployment; placeholders are acceptable only for a disposable test/mock instance |
| `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` | Same — this account has cross-facility access |
| `SENTRY_DSN` | A real DSN from sentry.io once that project exists — blank is a safe no-op |

Build:
```bash
npx prisma generate
npx prisma migrate deploy   # NOT `migrate dev` — non-interactive, safe to run unattended
npm run build
```

**Seeding — only for a test/mock instance, never real production:**
```bash
npm run seed
```
This creates demo admin/super-admin/patient accounts with the shared
password `testing@123` (and demo researcher accounts with
`ResearcherDemo123!`). For a real deployment, skip this and create the
first real admin account by hand instead (see `prisma/seed.ts` for the
shape it expects).

## 6. Run it, keep it running

```bash
pm2 start npm --name meeronbi -- start
pm2 save
pm2 startup   # prints a systemctl command — copy and run exactly what it outputs
pm2 save      # run once more after `pm2 startup` finishes, to be safe
```

Verify locally before involving nginx/DNS at all:
```bash
curl http://localhost:3000/api/health
```

## 7. Reverse proxy

```bash
sudo nano /etc/nginx/sites-available/meeronbi
```
```nginx
server {
    listen 80;
    server_name meeronbi-test.eikhoi.net;

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
```

The `X-Forwarded-For` header is what
`src/server/http/rateLimit.ts`'s `getClientIp()` reads — without it, every
request behind this proxy looks like it came from the same IP, silently
breaking per-IP rate limiting.

## 8. DNS

In GoDaddy's DNS management for `eikhoi.net` (**Domains → DNS**): add an
**A record** — host = the subdomain (e.g. `meeronbi-test`), value = the
Droplet's public IPv4 address. Propagation is usually fast but can take
longer; verify from the server itself once added:
```bash
dig +short <subdomain>.eikhoi.net @8.8.8.8
```

## 9. SSL

Once DNS resolves:
```bash
sudo certbot --nginx -d meeronbi-test.eikhoi.net
```
Answer the prompts (email, terms). Certbot edits the nginx config
automatically to add HTTPS and redirect HTTP → HTTPS, and schedules its
own auto-renewal — nothing further to configure.

## 10. Post-deploy checklist

- [ ] `curl https://<subdomain>.eikhoi.net/api/health` → `{"status":"ok",...}`, 200
- [ ] `curl -I http://<subdomain>.eikhoi.net` → redirects to `https://`
- [ ] `curl -I https://<subdomain>.eikhoi.net/` → all five security
      headers present (`X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`, `Permissions-Policy`,
      `Strict-Transport-Security`), no `X-Powered-By`
- [ ] Log in via the browser at `/login` and confirm the dashboard loads
- [ ] `SENTRY_DSN` set (or explicitly deferred)
- [ ] Backups wired per `docs/OPERATIONS.md` (for a Managed MySQL
      instance, this is largely already covered by the provider's own
      automated backups/PITR — confirm the retention window, don't just
      assume)
- [ ] `.env` file permissions restricted and confirmed in `.gitignore`
      (never committed)
- [ ] For anything beyond a disposable test instance: demo seed
      passwords (`testing@123`, `ResearcherDemo123!`) rotated or the
      accounts removed entirely

## 11. Updating the running app later

**This is now automated — see §12 and §13.** Every push to `main` that
passes CI deploys itself, health-checks the result, and rolls back if the
new release doesn't come up. The manual sequence below is the fallback for
when you're on the box and GitHub Actions isn't an option:

```bash
# On the server, after the §12 restructure:
bash /var/www/meeronbi/current/scripts/deploy.sh <git-sha>
bash /var/www/meeronbi/current/scripts/deploy.sh --rollback
```

## 12. One-time restructure to release directories

The original layout was a single `git clone` at `/var/www/meeronbi` that
was pulled and rebuilt in place. That has two problems worth fixing before
automating anything: a failed build leaves the live directory
half-updated, and rolling back means a full rebuild (minutes) rather than
a switch.

The layout `scripts/deploy.sh` expects instead:

```
/var/www/meeronbi/
  repo/              bare git mirror, fetched with the read-only deploy key
  releases/<sha>/    one extracted + built release
  shared/.env        the one real .env, symlinked into every release
  shared/logs/       pm2 logs, so they survive release pruning
  current -> releases/<sha>
```

Each release is built in full while the previous one keeps serving. Only a
release that builds gets the `current` symlink; only a release that then
passes its health check and smoke test keeps it.

Run this once, on the server, from the existing deployment:

```bash
cd /var/www/meeronbi

# Keep the existing, working .env — this is the one file that must survive.
mkdir -p shared/logs releases
cp .env shared/.env
chmod 600 shared/.env

# A bare mirror reusing the §3 deploy key. Nothing else needs repo access.
git clone --bare git@github.com:<owner>/<repo>.git repo

# Clear the old in-place checkout, keeping shared/, releases/ and repo/.
find . -maxdepth 1 -mindepth 1 \
  ! -name shared ! -name releases ! -name repo -exec rm -rf {} +

# First release through the new path. pm2 picks up ecosystem.config.cjs,
# so the old `pm2 start npm --name meeronbi -- start` process is replaced.
pm2 delete meeronbi || true
git -C repo show main:scripts/deploy.sh > /tmp/deploy.sh
bash /tmp/deploy.sh "$(git -C repo rev-parse main)"

pm2 save
```

Verify before moving on: `curl http://localhost:3000/api/health` returns
`"status":"ok"`, `readlink /var/www/meeronbi/current` points into
`releases/`, and `pm2 list` shows `meeronbi` online.

**Migrations are not rolled back.** `prisma migrate deploy` runs before the
symlink flip and Prisma has no down-migrations, so a rolled-back release
runs against the newer schema. Every migration must be backward-compatible
with the release before it: add columns rather than dropping or renaming
them in the same deploy that starts using them, and split a destructive
change across two deploys (stop using it, ship, then drop it).

## 13. Continuous deployment from GitHub Actions

`.github/workflows/deploy.yml` runs after `.github/workflows/ci.yml`
succeeds on `main`. It deploys the exact commit CI tested — not whatever
`main` has moved on to — by piping `scripts/deploy.sh` over SSH, so the
server never holds a copy of the deploy script that can drift.

### Server-side prerequisites

Create a dedicated deploy user rather than handing CI your root key:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /home/deploy/.ssh && sudo chmod 700 /home/deploy/.ssh
sudo chown -R deploy:deploy /home/deploy/.ssh /var/www/meeronbi

# pm2 and the release directory must be usable as this user.
sudo -u deploy pm2 startup   # run the systemctl line it prints
```

Generate a key pair **for CI specifically** (on your laptop, not the
server), so it can be revoked without affecting your own access:

```bash
ssh-keygen -t ed25519 -C "meeronbi-github-actions" -f ~/.ssh/meeronbi_ci
ssh-copy-id -i ~/.ssh/meeronbi_ci.pub deploy@<server-ip>
```

### Repository secrets

In GitHub → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `DEPLOY_SSH_KEY` | The full **private** key (`cat ~/.ssh/meeronbi_ci`), including the BEGIN/END lines |
| `DEPLOY_HOST` | The server's IP or hostname |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan -t ed25519 <server-ip>` |
| `DEPLOY_PUBLIC_URL` | `https://<subdomain>.eikhoi.net` — optional; enables the external post-deploy check |

`DEPLOY_KNOWN_HOSTS` is not optional busywork: without a pinned host key
the workflow would have to pass `StrictHostKeyChecking=no`, which accepts
*any* host answering on that address and hands it the deploy key.

Note that **GitHub Environments and required-reviewer approval gates are
not available for private repositories on the Free plan**, so these are
plain repository secrets and the CI gate is what protects production. If
you later want a human approving each release, either upgrade the plan or
switch `deploy.yml` to `workflow_dispatch`-only.

### What a deploy does

1. CI passes on `main` (lint, typecheck, unit tests, secret scan, SAST,
   dependency audit, and a full migrate + build + boot + smoke test).
2. `deploy.sh` fetches the commit, extracts it to `releases/<sha>`, and
   installs, generates Prisma, migrates, and builds — all while the
   previous release is still serving.
3. The `current` symlink flips and pm2 reloads.
4. The new release must answer `/api/health` with `"status":"ok"` and
   `"db":"ok"`, then pass `scripts/smoke.sh`.
5. If either fails, the symlink flips back, pm2 reloads the previous
   release, and the workflow fails.

pm2 runs in fork mode, so the reload is a restart — expect a **one to two
second blip**, not zero downtime. At single-facility scale that is the
right trade for the simplicity.

To roll back by hand: GitHub → **Actions → Deploy → Run workflow**, tick
**rollback**. Or on the server, `bash current/scripts/deploy.sh --rollback`.

## Known follow-ups from the first deployment

- **Next.js is pinned to 14.2.35, the final 14.x release.** There will be
  no further 14.x security patches; `npm audit` reports open critical
  advisories whose only fix is `next@16`. Each is individually assessed
  and accepted, with an expiry date, in `.github/audit-allowlist.json` —
  CI fails once those expire. The upgrade needs its own planned pass.
- **A 4GB droplet building a release while serving the previous one is
  tight.** If `npm run build` starts getting OOM-killed during a deploy,
  add swap (`fallocate -l 2G /swapfile`, `mkswap`, `swapon`, and an
  `/etc/fstab` entry) before resizing the box.
- **DigitalOcean may rotate the DB CA certificate.** If connections
  suddenly fail with a certificate error, re-download it (§4) and replace
  `/etc/meeronbi/ca-certificate.crt`.
- **CloudPanel was evaluated and abandoned** for this deployment due to a
  reproducible Doctrine migration bug in CloudPanel 2.5.4 on Ubuntu 24.04
  (`"no such table: site"`, independent of `DB_ENGINE`/`CLOUD` install
  flags). The manual nginx/certbot/pm2 setup in this doc is the proven
  path; don't re-attempt CloudPanel without a reason to expect a fixed
  release.
