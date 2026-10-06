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

Two things to know before starting, both of which bite silently otherwise:

- **pm2 is per-user.** The existing app runs under *root's* pm2 daemon. The
  new one runs under *deploy's*. Both will try to bind `:3000` unless root's
  is explicitly retired, so step 4 below is not optional.
- **`deploy.sh` runs `git fetch` as the deploy user**, so the GitHub deploy
  key has to belong to that user. The §3 key lives in `/root/.ssh` and is
  not reachable from `deploy`.

Expect **three to five minutes of downtime** while the first release builds.
Pick a quiet time. Everything is ordered so that the old deployment stays
intact and bootable until the new one is proven.

### 1. Create the deploy user

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo chown -R deploy:deploy /var/www/meeronbi
```

### 2. Give that user its own read-only GitHub deploy key

```bash
sudo -u deploy ssh-keygen -t ed25519 -C "meeronbi-deploy-user" \
  -f /home/deploy/.ssh/github_deploy -N ""
sudo -u deploy cat /home/deploy/.ssh/github_deploy.pub
```

Add that public key on GitHub: repo → **Settings → Deploy keys → Add deploy
key** → paste → **leave "Allow write access" unchecked.** This is a second,
separately revocable key; root's §3 key can be removed afterwards.

```bash
sudo -u deploy tee -a /home/deploy/.ssh/config > /dev/null << 'EOF'

Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
sudo -u deploy chmod 600 /home/deploy/.ssh/config

# Must print "Hi ...! You've successfully authenticated" before continuing.
sudo -u deploy ssh -T git@github.com
```

### 3. Build the new layout alongside the old one

Nothing here disturbs the running app — it only adds directories.

```bash
cd /var/www/meeronbi
sudo -u deploy mkdir -p shared/logs releases
sudo -u deploy cp .env shared/.env
sudo -u deploy chmod 600 shared/.env
sudo -u deploy git clone --bare git@github.com:varunbalaji167/MeeronBi.git repo
```

### 4. Retire root's pm2, hand over to deploy's

```bash
# Root's daemon: stop serving and stop coming back on reboot.
sudo pm2 delete meeronbi || true
sudo pm2 save --force
sudo pm2 unstartup systemd || true

# Deploy's daemon: register its own boot hook (run the line it prints).
sudo -u deploy pm2 startup
```

### 5. First release through the new path

```bash
sudo -u deploy git -C /var/www/meeronbi/repo show main:scripts/deploy.sh > /tmp/deploy.sh
sudo -u deploy bash /tmp/deploy.sh "$(sudo -u deploy git -C /var/www/meeronbi/repo rev-parse main)"
sudo -u deploy pm2 save
```

**Verify all four before continuing:**

```bash
curl http://localhost:3000/api/health          # "status":"ok","db":"ok"
readlink /var/www/meeronbi/current             # points into releases/
sudo -u deploy pm2 list                        # meeronbi online
sudo pm2 list                                  # root's list: no meeronbi
```

If the build failed, the old deployment is still intact — recover with
`sudo pm2 start npm --name meeronbi -- start` from `/var/www/meeronbi` and
investigate before retrying.

### 6. Only now, remove the old in-place checkout

```bash
cd /var/www/meeronbi
sudo find . -maxdepth 1 -mindepth 1 \
  ! -name shared ! -name releases ! -name repo ! -name current \
  -exec rm -rf {} +
curl http://localhost:3000/api/health          # still ok
```

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

§12 already created the `deploy` user, gave it its own GitHub deploy key,
and moved pm2 under it. What remains is letting GitHub Actions log in as
that user.

Note these are **two different keys with two different jobs**: §12's
`github_deploy` key lets the *server* pull from GitHub, while the key below
lets *GitHub Actions* SSH into the server. Neither can substitute for the
other.

Generate a key pair **for CI specifically** (on your laptop, not the
server), so it can be revoked without affecting your own access:

```bash
# On your laptop:
ssh-keygen -t ed25519 -C "meeronbi-github-actions" -f ~/.ssh/meeronbi_ci
cat ~/.ssh/meeronbi_ci.pub
```

`ssh-copy-id` will not work here — `deploy` was created with
`--disabled-password`, so there is no password for it to authenticate with.
Install the key through root instead:

```bash
# On the server, as a sudoer:
sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys <<< "<the public key line>"
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys
```

Confirm from your laptop before going further — this exact command is what
the workflow runs:

```bash
ssh -i ~/.ssh/meeronbi_ci -o BatchMode=yes deploy@<server-ip> "pm2 list"
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
