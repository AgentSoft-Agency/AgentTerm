# @agentsoft/agent-term

Shared long-running terminals for AI coding agents.

When one AI agent session starts a dev server, watcher, or build process, no other session can see its output or send it input. `agent-term` fixes this by routing persistent processes through shared [tmux](https://github.com/tmux/tmux) sessions that any agent session can access.

## How it works

`agent-term` installs a `SKILL.md` file into each detected agent's skill directory. The agent reads that skill at startup and auto-activates it when a task involves starting or managing a persistent process — a dev server, file watcher, tunnel, queue worker, or similar. The skill tells the agent which `agent-term` commands are available and when to use them. Short one-shot commands are not affected.

## Agent integration

### Claude Code

`agent-term init` installs `SKILL.md` at `~/.claude/skills/agent-term/SKILL.md`. The skill auto-activates when you ask the agent to start a persistent process.

### Codex CLI

`agent-term init` installs `SKILL.md` at `$CODEX_HOME/skills/agent-term/SKILL.md` (fallback: `~/.codex/skills/agent-term/SKILL.md`). The skill auto-activates when you ask the agent to start a persistent process.

### Gemini CLI

`agent-term init` installs `SKILL.md` at `~/.gemini/skills/agent-term/SKILL.md`. The skill auto-activates when you ask the agent to start a persistent process.

## Supported agents

| Agent | Status |
|-------|--------|
| Claude Code | Fully supported |
| Gemini CLI | Fully supported |
| Codex CLI | Fully supported |

## Prerequisites

- Node.js 18+
- [tmux](https://github.com/tmux/tmux) installed:
  - macOS: `brew install tmux`
  - Linux: `sudo apt install tmux`

## Installation

```bash
npm install -g @agentsoft/agent-term
```

## Setup

```bash
agent-term init
```

This will:
1. Check that tmux is installed
2. Auto-detect installed AI agents on your machine
3. Install the `agent-term` skill for the agents you select

For scripted/CI setups:

```bash
agent-term init --non-interactive --agents claude-code,gemini-cli
```

## Usage

### Automatic (via skill)

Once set up, the agent reaches for `agent-term` when you ask it to start or manage a persistent process. No pattern configuration needed.

### Manual

```bash
# Start a shared terminal
agent-term start --name frontend -- pnpm dev

# List active terminals
agent-term list

# Read output (last 100 lines)
agent-term logs frontend

# Read more output
agent-term logs frontend --lines 500

# Send input to a terminal
agent-term send frontend "rs"          # restart
agent-term send frontend "C-c"         # Ctrl+C (tmux key syntax)

# Check terminal status
agent-term status frontend

# Restart a terminal (kill + re-run same command)
agent-term restart frontend

# Kill a terminal
agent-term kill frontend
```

## How terminals are named

Commands are auto-named: `pnpm dev` becomes `pnpm-dev`, `docker compose up` becomes `docker-compose-up`. A random suffix is appended for uniqueness (e.g., `pnpm-dev-a3f0`). Use `--name` to override:

```bash
agent-term start --name frontend -- pnpm --filter app dev
```

## Architecture

- All terminals run on a dedicated tmux server (`tmux -L agent-term`), fully isolated from your own tmux sessions
- Session names are prefixed with `at-` (e.g., `at-frontend`)
- Each supported agent has an adapter that handles skill installation and legacy migration
- Graceful fallback: if tmux or agent-term fails, the agent falls back to running the command directly

## Migrating from 0.x

Run `agent-term init`. It will detect any existing agent-term hook entries in your agent config files and remove them automatically, then install the skill. The `hook` subcommand is removed in 1.0.0.

## Platform support

- **macOS** — full support
- **Linux** — full support
- **Windows** — not supported (WSL works as Linux)

## License

MIT
