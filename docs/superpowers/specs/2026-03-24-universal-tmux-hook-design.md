# Universal Tmux Hook Design

> **Superseded by:** [2026-04-16-skill-based-integration-design.md](./2026-04-16-skill-based-integration-design.md) (v1.0.0). This document describes the original hook-based integration. Kept for historical context.

## Summary

Replace the pattern-based command interception in agent-term with a universal approach: every Bash command goes through tmux. A timeout-based mechanism distinguishes short-lived commands (return full output) from long-running processes (return logs + terminal name for follow-up).

## Motivation

The current pattern-matching approach (`~/.agent-term/config`) is fragile. Commands like `pnpm --filter app run dev` or `cd dir && pnpm dev` don't match `pnpm dev*`. Users must constantly update patterns as their command shapes change. Removing patterns entirely solves this.

## Design

### Hook Flow

1. Hook intercepts every Bash command via the agent's pre-hook mechanism
2. **Self-check**: if the command starts with `agent-term`, pass through immediately (prevents infinite recursion)
3. Creates a tmux session with `remain-on-exit on` and a unique name (base name + short random suffix, e.g., `at-pnpm-dev-a3f`)
4. Polls the session status in a loop (200ms interval):
   - **Process exits before deadline** → capture full output via `capture-pane`, kill the dead session, return output to the agent as if it ran normally
   - **Deadline reached (~13s, 2s safety margin before 15s hook timeout)** → return recent logs + system message with the terminal name. Process keeps running in tmux. Session `remain-on-exit` is turned off so it auto-dies when the process eventually exits.
5. Dead sessions after long-running processes: `sessionExists` returns `false`, which tells the agent "process finished."

### Session Lifecycle

- **Short-lived commands**: session created → `remain-on-exit on` → command runs → command exits → session stays (remain-on-exit) → hook captures output → hook kills session
- **Long-running commands**: session created → `remain-on-exit on` → hook deadline reached → hook turns off `remain-on-exit` → hook returns logs → process keeps running → process eventually exits → session auto-dies
- Manual `agent-term kill` works at any point

### Session Naming

Hook-created sessions use a unique suffix to prevent collisions: `at-{autoName}-{randomSuffix}` (e.g., `at-ls-a3f`, `at-pnpm-dev-x7k`). The user-facing name includes the suffix. This prevents collisions from rapid sequential commands like `ls`.

The `agent-term start` command (manual use) keeps the current naming without suffix.

### What Changes

| File | Change |
|------|--------|
| `config.ts` | **Delete** |
| `adapter.ts` | Add `output` action to `HookResult` with `stdout` field |
| `commands/hook.ts` | Replace `processHook` — skip `agent-term` commands, route everything else to tmux, poll for exit or timeout. Becomes async with polling loop. |
| `commands/init.ts` | Remove config file creation. Keep agent detection + hook registration. |
| `tmux.ts` | Add `createSessionWithRemainOnExit()`, `setRemainOnExit(name, on/off)`, `waitForExit(sessionName, deadlineMs)` helpers |
| `naming.ts` | Add `uniqueName()` helper that appends random suffix |
| `adapters/claude-code.ts` | Update `formatHookOutput` to handle new `output` action |
| `adapters/gemini-cli.ts` | Update `formatHookOutput` to handle new `output` action |
| `adapters/codex-cli.ts` | Remove `loadPatterns` import. Update `generateContext()` to remove pattern listing section. Update context text to reflect universal routing. |
| Manual commands (`start`, `logs`, `send`, `kill`, `list`, `status`) | No change |

### HookResult Changes

```typescript
export interface HookResult {
  action: 'passthrough' | 'rewrite' | 'output';
  rewrittenCommand?: string;
  systemMessage?: string;
  stdout?: string; // full output for completed commands
}
```

- `passthrough` — used only for `agent-term` self-commands
- `output` — short-lived command finished, return stdout directly
- `rewrite` — long-running command, rewrite to `agent-term logs` for follow-up

### Adapter `formatHookOutput` Changes

For the `output` action, the hook writes the captured stdout to a temp file and rewrites the command to `cat` that file. This avoids escaping issues with quotes, backticks, dollar signs, and newlines in the output.

- **Claude Code**: `updatedInput.command` → `cat /tmp/agent-term-<id>.out` + system message with exit context
- **Gemini CLI**: same approach adapted to Gemini's hook response format
- **Codex CLI**: no change (context-mode, doesn't use `formatHookOutput`)

Temp files are written by the hook before returning and are ephemeral (the OS cleans `/tmp`).

### Init Command

Simplified:
1. Check tmux is installed
2. Detect installed agents
3. Register hooks for selected agents

No config file creation step.

### Removed

- `~/.agent-term/` config directory — no longer created or referenced
- `loadPatterns()`, `parsePatterns()`, `matchCommand()` — deleted with `config.ts`
- Pattern matching in `processHook()` — replaced with universal routing

### Error Handling

- **tmux failure** (server not running, permission error, session creation fails): fall back to `passthrough` so the command runs normally in the agent's shell. Universal routing must never block all commands due to a tmux issue.
- **Empty/whitespace commands**: pass through immediately.

### Deadline Constant

The 13s deadline is a hardcoded constant (`HOOK_DEADLINE_MS = 13000`). It assumes the agent's hook timeout is 15s. If a user changes their agent's hook timeout, they'd need to update this constant in the source. This is acceptable for now — a future version could accept it as a CLI flag or environment variable.

### Edge Cases

- **`agent-term` commands**: passed through immediately, never routed to tmux. The check looks for `agent-term` at the start of the command string after trimming.
- **Interactive commands** (vim, nano): will run in tmux but the agent can't interact with them meaningfully — same behavior as current agent shells. Not a regression.
- **Pipes/redirections**: handled by tmux since the full command string is passed to `new-session` which runs it in a shell
- **Codex CLI**: uses `context` hookMode, fires only at `SessionStart`. Universal routing doesn't apply — Codex injects context text telling the model to use `agent-term start` manually. Updated to remove pattern listing, replace with guidance that all long-running commands should use `agent-term start`.
- **Unique suffix**: 4 hex characters (65536 values), sufficient for automated agent usage. No retry on collision — statistically negligible.

### Test Impact

- Tests for `config.ts` (patterns, matching) — delete
- Tests for `processHook` — rewrite for new async behavior
- Tests for adapters — update for new `output` action in `formatHookOutput`
