# @agentsoft/agent-term

Shared long-running terminals for AI coding agents.

When one AI agent session starts a dev server, watcher, or build process, no other session can see its output or send it input. `agent-term` fixes this by routing all Bash commands through shared [tmux](https://github.com/tmux/tmux) sessions that any agent session can access.

## How it works

1. A pre-hook intercepts **every** Bash command the agent runs
2. The command runs inside a shared tmux session
3. Short-lived commands (< 13s) return full output transparently — the agent doesn't notice tmux
4. Long-running commands stay in tmux — the agent gets logs and the terminal name for follow-up
5. At session start, context is injected telling the agent about active terminals and `agent-term` commands

## Supported agents

| Agent | Status | Integration |
|-------|--------|-------------|
| Claude Code | Fully supported | `PreToolUse` + `SessionStart` hooks |
| Gemini CLI | Fully supported | `BeforeTool` + `SessionStart` hooks |
| Codex CLI | Fully supported | `SessionStart` context injection |

All agents get context injected at session start listing active terminals and available commands.

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
3. Register hooks for the agents you select (both command interception and session start context)

For scripted/CI setups:

```bash
agent-term init --non-interactive --agents claude-code,gemini-cli
```

## Usage

### Automatic (via hooks)

Once set up, all Bash commands are routed through tmux automatically. No configuration needed — no pattern files to maintain.

- **Quick commands** (`ls`, `git status`, `pnpm build`) finish and return output as if they ran normally
- **Long-running commands** (`pnpm dev`, `docker compose up`) stay running in tmux — the agent gets logs and can check back later

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
- Hook integration uses an adapter pattern — each agent has an adapter that handles its hook format
- Universal routing: every Bash command goes through tmux, no pattern configuration needed
- Graceful fallback: if tmux or agent-term fails, commands pass through to the agent's shell normally
- Context injection at session start tells agents about active terminals and available commands

## Platform support

- **macOS** — full support
- **Linux** — full support
- **Windows** — not supported (WSL works as Linux)

## License

MIT
