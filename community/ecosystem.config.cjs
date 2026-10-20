module.exports = {
  apps: [{
    name: "haivl",
    cwd: __dirname,
    script: "server/index.mjs",
    node_args: "--env-file-if-exists=.env",
    exec_mode: "fork",
    instances: 1,
    watch: false,
    autorestart: true,
    restart_delay: 3000,
    min_uptime: 10000,
    max_restarts: 10,
    shutdown_with_message: true,
    kill_timeout: 10000,
    wait_ready: true,
    listen_timeout: 15000,
    time: true
  }]
};
