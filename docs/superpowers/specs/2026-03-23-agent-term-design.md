# agent-term — Design Spec

**Date:** 2026-03-23
**Status:** Draft
**Repo:** `agent-term` (new, standalone — `/Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term`)

## Problem

AI coding agent sessions (Claude Code, Gemini CLI, Codex CLI) have isolated shell processes. When one session starts a long-running process (dev server, watcher, build), no other session can see its output or send it input. This forces users to context-switch between sessions or restart processes.

## Solution

An npm package (`agent-term`) that centralizes long-running terminal processes in tmux sessions, making them accessible from any AI agent session via a CLI tool and agent-specific hook adapters.

## Goals

- Any AI agent session can read logs from and send input to shared long-running processes
- Long-running commands are automatically intercepted and routed to tmux via agent-specific pre-hooks
- Short commands (git, ls, etc.) pass through with zero overhead
- tmux is an invisible implementation detail — users interact only with the `agent-term` CLI
- Agent-agnostic: ships with adapters for Claude Code, Gemini CLI, and Codex CLI
- Interactive setup auto-detects installed agents
- Works on macOS and Linux

## Non-Goals

- Windows support (tmux doesn't run natively; WSL would work as Linux)
- Automatic detection of long-running commands (user configures patterns)
- GUI or TUI interface
- Session sharing across machines (local only)

## Architecture

Four components:

### 1. `agent-term` CLI

A TypeScript CLI tool installed globally via npm. Exposes subcommands for managing shared terminals.

#### Subcommands

| Command | Description |
|---|---|
| `agent-term init` | Interactive setup: check tmux, create `~/.agent-term/config`, auto-detect agents, register hooks. Also supports `--non-interactive --agents claude-code,gemini-cli` for scripted setups. |
| `agent-term hook --agent <name>` | The agent pre-hook entry point. Called by agents on shell tool invocations, not by users directly. Reads hook JSON from stdin, dispatches to the named adapter for translation, matches against patterns, intercepts or passes through. |
| `agent-term start [--name <name>] -- <command>` | Creates a tmux session running `<command>`. Auto-names from command if `--name` is omitted. Waits up to 3 seconds for initial output, then prints captured scrollback to stdout. If no output within 3s, prints "Terminal '<name>' started, awaiting output...". If the session already exists and is running, prints its logs instead (handles race condition). |
| `agent-term list [--json]` | Lists all active shared terminals: name, command, pid, running/exited status, uptime. Default output is a human-readable table. `--json` outputs structured JSON for programmatic use. |
| `agent-term logs <name> [--lines N]` | Captures last N lines (default 100) from the tmux pane scrollback buffer. |
| `agent-term send <name> <input>` | Sends keystrokes to the tmux session via `tmux send-keys`. Uses tmux's send-keys syntax: plain text is sent as-is, control sequences use tmux notation (`C-c` for Ctrl+C, `Enter` for Enter, `C-d` for EOF). |
| `agent-term kill <name>` | Kills the tmux session and cleans up. |
| `agent-term status <name>` | Shows process running state, exit code if exited, last few lines of output. |

#### Naming Logic

- `--name` flag takes priority over auto-naming
- Auto-name derived from command: `pnpm dev` → `pnpm-dev`, `docker compose up` → `docker-compose-up`
- On name collision, append `-2`, `-3`, etc.
- All tmux sessions use a dedicated tmux server (`tmux -L agent-term`) to fully isolate from user's own tmux sessions. Session names use the `at-` prefix for clarity (e.g., `at-pnpm-dev`)

### 2. Agent Adapter System

Each adapter is a module that knows how to detect, register, unregister, and translate for a specific agent.

#### Adapter Interface

```typescript
interface AgentAdapter {
  name: string;              // "claude-code", "gemini-cli", "codex-cli"
  displayName: string;       // "Claude Code", "Gemini CLI", "Codex CLI"
  configPath: string;        // Path to agent's config file
  detect(): boolean;         // Does the agent's config directory exist?
  register(): void;          // Write hook config to agent's settings
  unregister(): void;        // Remove hook config from agent's settings
  parseHookInput(stdin: string): HookInput;   // Agent-specific stdin → common format
  formatHookOutput(result: HookResult): string; // Common format → agent-specific stdout
}
```

#### Common Internal Format

```typescript
interface HookInput {
  command: string;           // The bash command being executed
  sessionId?: string;        // Agent's session ID (if available)
}

interface HookResult {
  action: 'passthrough' | 'rewrite';
  rewrittenCommand?: string; // Only when action = 'rewrite'
  systemMessage?: string;    // Optional message back to agent
}
```

#### Supported Agents

**Claude Code** (fully specified)
- Detection: `~/.claude/` exists
- Config: `~/.claude/settings.json` (user-level)
- Hook: `PreToolUse` with `matcher: "Bash"`
- Stdin: Only the fields relevant to agent-term are shown; additional fields (`tool_name`, `transcript_path`, `cwd`, `permission_mode`, `tool_use_id`) are present but ignored.
  ```json
  {
    "session_id": "abc123",
    "tool_input": { "command": "pnpm dev" }
  }
  ```
- Stdout (passthrough — no output, exit 0):
  _(empty)_
- Stdout (rewrite — exit 0):
  ```json
  {
    "hookSpecificOutput": {
      "permissionDecision": "allow",
      "updatedInput": { "command": "agent-term start --name pnpm-dev -- pnpm dev" }
    },
    "systemMessage": "Command routed to shared terminal 'pnpm-dev' via agent-term."
  }
  ```
- Hook registration JSON written to `~/.claude/settings.json`:
  ```json
  {
    "hooks": {
      "PreToolUse": [{
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "agent-term hook --agent claude-code",
          "timeout": 15
        }]
      }]
    }
  }
  ```

**Gemini CLI** (stub — format TBD)
- Detection: `~/.gemini/` exists
- Config: `~/.gemini/settings.json` (user-level)
- The adapter implements the `AgentAdapter` interface but the exact hook stdin/stdout format depends on Gemini CLI's documentation. At MVP, the adapter registers a placeholder hook and logs a warning if invoked, directing the user to check for updates.

**Codex CLI** (stub — format TBD)
- Detection: `~/.codex/` exists
- Config: `~/.codex/config.json` (user-level)
- Same as Gemini CLI: stub adapter at MVP, full implementation once Codex CLI's hook format is confirmed.

Note: The adapter interface is fully defined, so adding real Gemini/Codex support is a matter of filling in the translation methods. The core logic is agent-agnostic and does not depend on any agent's specific format.

#### Registration Safety

Each adapter reads the existing agent config, merges the hook entry without clobbering existing hooks, and writes back. Merge strategy for Claude Code: read the existing `hooks.PreToolUse` array, check if an entry with `command` containing `agent-term` already exists (skip if so), otherwise append to the array. Unregister removes only the entry whose `command` contains `agent-term`.

### 3. Interactive Init

`agent-term init` runs an interactive setup with auto-detection.

#### Flow

1. Check tmux is installed. If not, show OS-specific install command and exit:
   - macOS: `brew install tmux`
   - Linux: `apt install tmux` or `dnf install tmux`
2. Create `~/.agent-term/config` with default patterns (skip if exists, ask to overwrite).
3. Scan for installed agents using each adapter's `detect()` method.
4. Show a checkbox multi-select with detected agents pre-checked:
   ```
   ✔ agent-term init

   Found 2 agents installed on this machine:

   ◉ Claude Code    (~/.claude/settings.json)
   ◉ Gemini CLI     (~/.gemini/settings.json)
   ○ Codex CLI      (not detected)

   ↑/↓ navigate  ⎵ toggle  ↵ confirm
   ```
5. For each selected agent, show a preview of what will be added to its config.
6. Confirm and write all hook registrations.
7. Print success summary.

#### Non-Interactive Mode

`agent-term init --non-interactive --agents claude-code,gemini-cli` for scripted setups, CI, or dotfiles bootstrapping.

### 4. Configuration

**File:** `~/.agent-term/config`

Line-based format with glob-style patterns:

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

#### Matching Rules

- Patterns match against the full command string
- `*` is a glob wildcard
- Lines starting with `#` are comments
- Empty lines are ignored
- First match wins

A sensible default config is created by `agent-term init`. Users edit it to add their own patterns.

## Hook Logic

The `agent-term hook --agent <name>` command is the universal entry point for all agents.

1. Load the adapter for `<name>` from the registry
2. Read stdin, pass to `adapter.parseHookInput()` → common `HookInput`
3. Match `HookInput.command` against patterns in `~/.agent-term/config`
4. **No match** → return passthrough result
5. **Match** → derive the base auto-name from the command (before any collision suffix) and check if a shared terminal with that base name already exists:
   - **Exists and running** → rewrite to `agent-term logs <base-name> --lines 50`
   - **Doesn't exist** → rewrite to `agent-term start -- <command>` (collision suffixing `-2`, `-3` only applies inside `agent-term start` when the user explicitly wants a second instance via `--name`)
6. Pass `HookResult` to `adapter.formatHookOutput()` → agent-specific stdout
7. Print to stdout and exit 0

#### Exit Code Contract

| Exit Code | Behavior |
|---|---|
| **0** with no output | Allow — command passes through unmodified |
| **0** with JSON output | Allow with rewrite — command is replaced |
| **2** | Blocking error — stderr shown, tool call blocked |
| **Other** | Non-blocking error — logged, command proceeds |

#### Graceful Degradation

If `agent-term` or `tmux` is unavailable, the hook exits 0 with no output (pass-through). The original command runs normally.

## Project Structure

```
agent-term/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts                    # Entry point, subcommand routing
│   ├── commands/
│   │   ├── init.ts               # Interactive setup
│   │   ├── hook.ts               # Hook entry point (--agent dispatches to adapter)
│   │   ├── start.ts              # Start a shared terminal
│   │   ├── list.ts               # List active terminals
│   │   ├── logs.ts               # Read tmux scrollback
│   │   ├── send.ts               # Send input to terminal
│   │   ├── kill.ts               # Kill a terminal
│   │   └── status.ts             # Show terminal status
│   ├── adapters/
│   │   ├── adapter.ts            # AgentAdapter interface
│   │   ├── claude-code.ts        # Claude Code adapter
│   │   ├── gemini-cli.ts         # Gemini CLI adapter
│   │   ├── codex-cli.ts          # Codex CLI adapter
│   │   └── registry.ts           # Adapter lookup by name, detection scan
│   ├── tmux.ts                   # tmux wrapper (spawn commands)
│   ├── config.ts                 # Load/parse ~/.agent-term/config
│   └── naming.ts                 # Auto-name generation from commands
└── README.md
```

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Package manager:** pnpm
- **Dependencies:**
  - `commander` — CLI argument parsing
  - `@clack/prompts` — interactive init UI
  - `child_process.spawn` — tmux interaction
- **Build:** `tsc` to compile, `bin` field in package.json for the `agent-term` command

## Installation Flow

```bash
pnpm install -g agent-term
agent-term init
```

## Session Lifecycle

1. An AI agent session runs a matching command (e.g., `pnpm dev`)
2. The agent's pre-hook calls `agent-term hook --agent <agent-name>`
3. Hook intercepts, `agent-term start` creates tmux session `at-pnpm-dev`
4. Initial output returned to the agent session
5. Any agent session can now:
   - `agent-term logs pnpm-dev` — read output
   - `agent-term send pnpm-dev "some input"` — send input
   - `agent-term status pnpm-dev` — check if still running
6. Process persists until explicitly killed via `agent-term kill pnpm-dev`
7. Exited processes retain their tmux session (with scrollback) until killed

## Edge Cases

- **Duplicate start:** If a session tries to start a command that's already running in a shared terminal, the hook rewrites to `agent-term logs` instead. Additionally, `agent-term start` itself handles the TOCTOU race — if `tmux new-session` fails because the session already exists (two sessions racing), it falls back to returning logs from the existing session rather than erroring.
- **tmux not installed:** Hook exits 0 with no output (pass-through). CLI commands print a helpful error with OS-specific install instructions.
- **Config file missing:** Hook exits 0 with no output (pass-through). CLI commands (except `init`) print a message suggesting `agent-term init`.
- **Name collision:** Auto-naming appends `-2`, `-3`, etc.
- **Process crashes:** The tmux session stays around with the crash output. `agent-term status` shows the exit code.
- **Hook timeout:** The hook has a 15-second timeout. If `agent-term start` takes longer (slow process startup), the hook times out and the agent proceeds normally. The tmux session still gets created in the background — the user can access it via `agent-term logs` afterward.
- **Multiple agents, same terminal:** Terminals are shared across all agents. A Claude Code session can start `pnpm dev`, and a Gemini CLI session can read its logs. The tmux layer is agent-agnostic.
- **Unknown --agent flag:** `agent-term hook --agent unknown` exits 0 with no output (pass-through). Logs a warning to stderr.

## Platform Support

- **macOS:** Full support. tmux via Homebrew. Default shell zsh.
- **Linux:** Full support. tmux via system package manager. Bash or zsh.
- **Windows:** Not supported. WSL users get Linux support.

## What's NOT in Scope

- Web UI or dashboard integration
- Remote/networked terminal sharing
- Automatic long-running command detection (pattern-based only)
- Agent SDK/API (agents use hooks, not a library)
