// pm2 process definition, re-read on every deploy by scripts/deploy.sh.
//
// `cwd` deliberately points at the `current` symlink rather than a release
// directory: pm2 resolves it fresh when it spawns the process, so flipping the
// symlink and reloading is what moves the app between releases.
module.exports = {
  apps: [
    {
      name: "meeronbi",
      cwd: "/var/www/meeronbi/current",
      // Next's binary directly rather than via `npm start`, so pm2 supervises
      // and signals the real server process instead of an npm wrapper.
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      // The droplet is a 2 vCPU / 4GB box also running nginx; a leaked-memory
      // process should be recycled rather than invite the OOM killer.
      max_memory_restart: "1G",
      kill_timeout: 10000,
      listen_timeout: 15000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "/var/www/meeronbi/shared/logs/error.log",
      out_file: "/var/www/meeronbi/shared/logs/out.log",
      time: true,
    },
    {
      name: "meeronbi-email-worker",
      cwd: "/var/www/meeronbi/current",
      // tsx is a dependency (not devDependency) specifically so this survives a production
      // `npm ci` even if one is ever changed to --omit=dev.
      script: "node_modules/.bin/tsx",
      args: "scripts/email-worker.ts",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      // Generous enough for the SIGTERM drain in scripts/email-worker.ts to finish an in-flight send.
      kill_timeout: 20000,
      listen_timeout: 15000,
      env: {
        NODE_ENV: "production",
      },
      error_file: "/var/www/meeronbi/shared/logs/email-worker-error.log",
      out_file: "/var/www/meeronbi/shared/logs/email-worker-out.log",
      time: true,
    },
  ],
};
