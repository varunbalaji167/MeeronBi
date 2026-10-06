# Runbook

What to do when something fails. Each entry is symptom → diagnose → fix.

Architecture and provisioning: `docs/DEPLOYMENT.md`. What CI checks:
`docs/TESTING.md`.

---

## Start here

```bash
# 1. Is the site up, from outside?
curl -s -o /dev/null -w "%{http_code}\n" https://meeronbi-test.eikhoi.net/api/health

# 2. Is the app up, from inside? (skips nginx/DNS/TLS)
ssh -i ~/.ssh/meeronbi_ci deploy@68.183.82.126 'curl -s http://127.0.0.1:3000/api/health'
```

| 1 | 2 | Problem is in |
|---|---|---|
| ✅ 200 | ✅ ok | Not the platform — check the browser, a specific route, or the database |
| ❌ | ✅ ok | nginx, TLS, DNS or the firewall → *Site unreachable from outside* |
| ❌ | ❌ down/no answer | The app or its database → *App is down* |
| ✅ 200 | `"db":"down"` | Database → *Database unreachable* |

**If users are affected, roll back first and diagnose afterwards.** Actions →
Deploy → Run workflow → tick *rollback*. Or on the server:

```bash
sudo -iu deploy bash /var/www/meeronbi/current/scripts/deploy.sh --rollback
```

---

## App is down

```bash
sudo -iu deploy pm2 list          # is `meeronbi` online?
sudo -iu deploy pm2 logs meeronbi --lines 100
readlink /var/www/meeronbi/current
```

**pm2 shows `errored` or constant restarts.** Read the log — this is almost
always a bad `shared/.env` (a mistyped `DATABASE_URL`, a missing
`NEXTAUTH_SECRET`) or a database the app cannot reach. Fix `shared/.env`, then
`sudo -iu deploy pm2 restart meeronbi`.

**pm2 list is empty.** The process was deleted or the daemon restarted without
a saved list:

```bash
sudo -iu deploy pm2 start /var/www/meeronbi/current/ecosystem.config.cjs
sudo -iu deploy pm2 save
```

**App is down after a reboot.** The boot hook was never registered. Run
`sudo -iu deploy pm2 startup` and execute the line it prints, then `pm2 save`.

**Two processes fighting over :3000.** pm2 is per-user. Check *both* daemons:

```bash
sudo pm2 list                     # must be EMPTY
sudo -iu deploy pm2 list          # the real one
```

If root's has a `meeronbi` entry: `sudo pm2 delete meeronbi && sudo pm2 save --force && sudo pm2 unstartup systemd`.

**`current` points somewhere wrong or is missing.** Repoint it at a known-good
release and reload:

```bash
ls -1t /var/www/meeronbi/releases
sudo -iu deploy bash -c 'ln -sfn /var/www/meeronbi/releases/<sha> /var/www/meeronbi/current.tmp \
  && node -e "require(\"fs\").renameSync(\"/var/www/meeronbi/current.tmp\",\"/var/www/meeronbi/current\")"'
sudo -iu deploy pm2 reload /var/www/meeronbi/current/ecosystem.config.cjs --update-env
```

---

## Deploy failed

`deploy.sh` builds entirely before touching `current`. **A failure during
fetch, install, migrate or build never affects users** — the old release is
still serving. Failures after the symlink flip roll back automatically.

Match the message in the Actions log:

| Message | Cause | Fix |
|---|---|---|
| `'<cmd>' is not on PATH for this SSH session` | node/npm/pm2/git/curl missing for a non-login SSH session | Check `sudo -iu deploy which node npm pm2 git curl` |
| `/var/www/meeronbi/repo missing` | Bare mirror gone or wrong owner | Re-clone it as `deploy` (see DEPLOYMENT.md) |
| `shared/.env missing` | Config file deleted or wrong owner | Restore it, `chmod 600`, `chown deploy:deploy` |
| `commit <sha> not found in origin/main after fetch` | Deploying a SHA not on `main`, or the deploy key lost repo access | `sudo -iu deploy ssh -T git@github.com` must greet you |
| `DEPLOY_SSH_KEY and DEPLOY_KNOWN_HOSTS ... not set` | Repository secrets missing | Add them (DEPLOYMENT.md → Continuous deployment) |
| `no previous release recorded to roll back to` | First deploy, or `shared/previous_release` is gone | Deploy a known-good SHA explicitly instead |
| `new release did not become healthy` | App built but won't serve, or DB unreachable | Rolled back already. See *App is down* |
| `smoke test failed against the new release` | App serves but behaves wrong | Rolled back already. See below |
| `ROLLBACK ALSO FAILED ITS HEALTH CHECK` | Both releases broken — usually shared state | **Site is down.** See below |

### `npm ci` or `npm run build` fails on the server but passed in CI

Almost always memory. The build runs while the old release is still resident.

```bash
free -h                           # swap should be non-zero
dmesg -T | grep -i "killed process"
```

If swap is missing, add it (DEPLOYMENT.md → Prerequisites). If it's an OOM
kill, that's the cause — CI runners have more RAM than the droplet, which is
why CI passed.

### Smoke test failed

The log names the exact assertion. Run it yourself for detail:

```bash
sudo -iu deploy bash /var/www/meeronbi/current/scripts/smoke.sh http://127.0.0.1:3000
```

| Failing assertion | Means |
|---|---|
| `/api/health reports a reachable database` | Database problem, not an app problem |
| `/api/health is evaluated per request` | The route got prerendered — `export const dynamic = "force-dynamic"` was removed from `src/app/api/health/route.ts`. **This also blinds the rollback gate** |
| `/admin redirects to sign-in` returned 200 | **Auth boundary broken.** Middleware or a guard stopped applying. Treat as a security incident |
| `X-Frame-Options present` etc. | `headers()` in `next.config.mjs` was changed |
| unknown route 404s cleanly | Routing or a catch-all handler changed |

### `ROLLBACK ALSO FAILED ITS HEALTH CHECK`

Both releases are down, so the cause is shared, not in the code: the database,
`shared/.env`, or the host. Check in that order.

```bash
sudo -iu deploy pm2 logs meeronbi --lines 50
sudo -iu deploy cat /var/www/meeronbi/shared/.env | grep -c DATABASE_URL
df -h /; free -h
```

---

## CI failed

### `verify`

Reproduce exactly: `npm run verify`. Nothing environment-specific here — if it
passes locally and fails in CI, check for an uncommitted file.

### `app`

| Step | Cause |
|---|---|
| `Wait for MySQL` → `MySQL never became reachable` | Service container failed to start. Re-run the job; if it repeats, the `mysql:8.4` image or its health check changed |
| `Apply migrations from scratch` | A migration works incrementally but not on an empty database. **Real bug** — it would fail the same way on a new facility's server |
| `schema.prisma does not match prisma/migrations` | `schema.prisma` was edited without generating a migration. Run `npx prisma migrate dev` and commit the result |
| `Production build` | Reproduce with `npm run build`. Typically a Server/Client Component boundary error or a bad import — things `tsc` does not catch |
| `App never became healthy within 120s` | The built app won't boot. The `Application log` step (runs on failure) has the stack trace |
| `Smoke test` | See the smoke table above — identical assertions |

### `security`

| Check | Fix |
|---|---|
| gitleaks found a secret | **Rotate the credential first** — it's in git history permanently; removing the file does not help. Then add an allowlist entry in `.gitleaks.toml` only if it was a false positive |
| Semgrep ERROR finding | Reproduce with `npm run security`. Fix the code; suppress with an inline comment only with a written reason |
| `BLOCKING — new high/critical advisories` | Run `npm audit fix`. If no non-breaking fix exists, add an entry to `.github/audit-allowlist.json` with an app-specific reason and an expiry date |
| `Allowlist entries have EXPIRED` | Working as designed — re-assess the advisory, then fix it or extend the expiry with a fresh justification |

### Deploy didn't trigger after a green CI run

`deploy.yml` fires on `workflow_run` only when it is on the **default branch**,
so the first run after merging it typically doesn't fire. Trigger it once
manually (Actions → Deploy → Run workflow); subsequent pushes are automatic.

Also confirm CI's conclusion was `success` — `cancelled` or `skipped` does not
trigger a deploy, by design.

---

## Database unreachable

`/api/health` returns 503 with `"db":"down"`.

```bash
# Does the app's own connection string work?
sudo -iu deploy bash -c 'cd /var/www/meeronbi/current && npx prisma db execute --stdin <<< "SELECT 1;"'
```

Common causes, in order:

1. **The droplet is not in the cluster's Trusted Sources.** Managed databases
   reject everything until it's added, including after a droplet rebuild or IP
   change.
2. **The CA certificate was rotated.** Symptom is a TLS/certificate error.
   Re-download it and replace `/etc/meeronbi/ca-certificate.crt`.
3. **`DATABASE_URL` is being overridden by process env**, which silently beats
   `.env`:
   ```bash
   sudo -iu deploy env | grep DATABASE     # must print nothing
   ```
4. **Credentials rotated** on the cluster without `shared/.env` being updated.

---

## Login broken

Users reach `/login` but cannot sign in.

- **Everyone, suddenly, after a deploy** — `NEXTAUTH_SECRET` changed. Every
  existing session cookie is invalid. Restore the original value; if it is
  genuinely lost, users must sign in again.
- **"Session is no longer valid"** — `AUTH.SESSION_STALE`: the session points
  at a user row that no longer exists, typically after a reseed. Sign out and
  back in.
- **Redirect loop, or callback URL errors** — `NEXTAUTH_URL` does not match the
  real origin. It must be the full `https://` URL of this instance.
- **"Too many sign-in attempts"** — rate limiting is working (5/minute per IP).
  If *all* users hit it at once, nginx is not passing `X-Forwarded-For`, so
  every request looks like one IP. Check the proxy config.
- **Researchers only** — their approval status is re-checked against the
  database on every call, so a `PENDING` or `REJECTED` profile blocks sign-in
  by design.

---

## Site unreachable from outside, app healthy inside

```bash
systemctl status nginx
nginx -t
ufw status                                   # 80 and 443 must be allowed
dig +short meeronbi-test.eikhoi.net @8.8.8.8  # must be the droplet IP
certbot certificates                          # expiry
```

- **502 Bad Gateway** — nginx is up, the app is not, or it's not on `:3000`.
- **Certificate expired** — `certbot renew` then `systemctl reload nginx`.
  Renewal is automatic, so investigate why the timer did not run.
- **DNS resolves to the wrong IP** — the droplet was rebuilt or recreated.
  Update the A record at GoDaddy.

---

## Disk or memory

```bash
df -h /
du -sh /var/www/meeronbi/releases/*
free -h
```

Each release carries its own `node_modules` and `.next` — on the order of
**1 GB** (`node_modules` alone is ~600 MB, since the build needs devDependencies).
Five retained releases is therefore several GB; measure with the `du` above
rather than assuming.

`deploy.sh` keeps the last 5 and prunes the rest. If pruning has been failing,
old directories accumulate. Never delete the one `current` points at, nor the
one named in `shared/previous_release` — that is your rollback target.

---

## Escalation

If the site is down and the cause is not obvious within a few minutes, restore
service first:

1. Roll back (Actions → Deploy → Run workflow → *rollback*).
2. If that fails, point `current` at the newest release that is known good and
   reload pm2 (*App is down* above).
3. If the whole droplet is unresponsive, reboot from the provider console. pm2
   restores the saved process list on boot, assuming `pm2 save` was run.

Then diagnose with the service restored.
