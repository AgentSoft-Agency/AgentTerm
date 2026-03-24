# @agentsoft/agent-term

Shared long-running terminals for AI coding agents.

When one AI agent session starts a dev server, watcher, or build process, no other session can see its output or send it input. `agent-term` fixes this by routing long-running commands into shared [tmux](https://github.com/tmux/tmux) sessions that any agent session can access.

## How it works

1. A pre-hook intercepts matching commands (e.g., `pnpm dev`)
2. The command runs inside a shared tmux session instead of the agent's shell
3. Any agent session can read logs, send input, or check status

## Supported agents

| Agent | Status |
|-------|--------|
| Claude Code | Fully supported |
| Gemini CLI | Fully supported |
| Codex CLI | Stub (adapter ready, hook format TBD) |

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
2. Create `~/.agent-term/config` with default command patterns
3. Auto-detect installed AI agents on your machine
4. Register hooks for the agents you select

For scripted/CI setups:

```bash
agent-term init --non-interactive --agents claude-code
```

## Usage

### Automatic (via hooks)

Once set up, matching commands are intercepted automatically. When an agent runs `pnpm dev`, the hook routes it to a shared terminal. If the terminal is already running, the agent gets recent logs instead.

### Manual

```bash
# Start a shared terminal
agent-term start -- pnpm dev

# List active terminals
agent-term list

# Read output (last 100 lines)
agent-term logs pnpm-dev

# Read more output
agent-term logs pnpm-dev --lines 500

# Send input to a terminal
agent-term send pnpm-dev "rs"          # restart
agent-term send pnpm-dev "C-c"         # Ctrl+C (tmux key syntax)

# Check terminal status
agent-term status pnpm-dev

# Kill a terminal
agent-term kill pnpm-dev
```

## Configuration

Edit `~/.agent-term/config` to control which commands get intercepted:

```
# Long-running dev servers
pnpm dev*
pnpm run dev*
npm run dev*
yarn dev*

# Docker
docker compose up*
docker-compose up*

# Watchers
pnpm run watch*
nodemon *
tsx watch *

# Custom
pnpm start*
```

Patterns use glob-style matching. Lines starting with `#` are comments. First match wins.

## How terminals are named

Commands are auto-named: `pnpm dev` becomes `pnpm-dev`, `docker compose up` becomes `docker-compose-up`. Use `--name` to override:

```bash
agent-term start --name my-server -- pnpm dev
```

## Architecture

- All terminals run on a dedicated tmux server (`tmux -L agent-term`), fully isolated from your own tmux sessions
- Session names are prefixed with `at-` (e.g., `at-pnpm-dev`)
- Hook integration uses an adapter pattern — each agent has an adapter that translates between its hook format and agent-term's internal format
- Persistence is fire-and-forget: if tmux or agent-term is unavailable, commands pass through normally

## Platform support

- **macOS** — full support
- **Linux** — full support
- **Windows** — not supported (WSL works as Linux)

## License

MIT
