---
name: agent-term
description: Use BEFORE starting any persistent process that does not exit on its own — dev servers (npm/pnpm/yarn run dev, next dev, vite, uvicorn, rails server), file watchers, tail -f, ngrok/cloudflared tunnels, log streamers, queue workers, or any daemon. Also use when checking output, restarting, or killing such a process. DO NOT use for builds, tests, installs, or one-shot scripts.
---

# agent-term

agent-term manages long-lived processes in shared tmux sessions that survive across conversations. Use it instead of backgrounding commands natively.

## When this skill applies

**Use agent-term for persistent processes:**
- Dev servers (`npm run dev`, `pnpm dev`, `next dev`, `vite`, `uvicorn`, `rails server`)
- File watchers (`tsc --watch`, `nodemon`, `vitest --watch`)
- Log streamers (`tail -f`, `kubectl logs -f`, `journalctl -f`)
- Tunnels (`ngrok`, `cloudflared tunnel`)
- Queue workers, daemons, any process that does not exit on its own

**Do NOT use agent-term for:**
- Builds (`pnpm build`, `cargo build`, `make`) — let them run foreground
- Tests (`pnpm test`, `pytest`) — let them run foreground
- Installs (`pnpm install`, `npm i`) — let them run foreground
- One-shot scripts that exit in seconds

## Workflow

### 1. Check what is already running

Before starting anything, run:

```
agent-term list
```

If the process you need is already running, reuse it with `logs`/`send`/`restart`. Do not spawn a duplicate.

### 2. Start a new process

```
agent-term start --name <name> -- <command>
```

- `<name>` — lowercase, hyphenated, project-prefixed. Examples: `macroflow-api`, `macroflow-app`, `gymbro-web`. Avoid generic names like `dev`, `server`, `app`.
- `<command>` — the full command after `--`. Quote nothing extra; pass arguments naturally.

Example:

```
agent-term start --name macroflow-api -- pnpm --filter api run start:dev
```

### 3. Read output

```
agent-term logs <name>
agent-term logs <name> --lines 500
```

### 4. Send input (for processes that read stdin)

```
agent-term send <name> "rs"
```

Example: sending `rs` to a running `nodemon` to force a restart.

### 5. Lifecycle

```
agent-term status <name>    # is it still alive?
agent-term restart <name>   # kill and re-run the same command
agent-term kill <name>      # stop it
```

## Rules

- Always `list` before `start`.
- Name terminals descriptively — the name is how humans and future agents find them.
- Prefer `restart` over `kill` + `start` when you just need to apply a change.
- Never background a persistent process with `&`, `nohup`, or a native `run_in_background` flag. Use `agent-term start`.
