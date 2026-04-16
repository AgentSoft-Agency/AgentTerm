# Session Context Injection Design

> **Superseded by:** [2026-04-16-skill-based-integration-design.md](./2026-04-16-skill-based-integration-design.md) (v1.0.0). This document describes the original hook-based integration. Kept for historical context.

## Summary

Add SessionStart hooks to Claude Code and Gemini CLI adapters so agents know agent-term is available and how to use it. Currently only Codex CLI injects context; Claude Code and Gemini CLI agents have no idea agent-term exists.

## Motivation

The universal tmux hook intercepts commands transparently, but agents don't know they can use `agent-term logs`, `agent-term list`, etc. to check on running processes. They fumble around looking for temp files or log directories instead.

## Design

### What Changes

| File | Change |
|------|--------|
| `src/adapters/context.ts` | **New** — shared `buildContextText()` function |
| `src/adapters/adapter.ts` | Add `isSessionStart(stdin)` method to interface |
| `src/adapters/claude-code.ts` | Add `generateContext()`, `isSessionStart()`. Update `register()` / `unregister()` for SessionStart hook. |
| `src/adapters/gemini-cli.ts` | Add `generateContext()`, `isSessionStart()`. Update `register()` / `unregister()` for SessionStart hook. |
| `src/adapters/codex-cli.ts` | Refactor `generateContext()` to use shared `buildContextText()`. Add `isSessionStart()` (always returns true — Codex only fires on SessionStart). |
| `src/commands/hook.ts` | Replace `hookMode` check with `adapter.isSessionStart(stdin)` for routing. |

### Routing Logic in `runHook`

Replace the current `hookMode === 'context'` check with stdin-based event detection:

```typescript
// Current (remove):
if (adapter.hookMode === 'context' && adapter.generateContext) { ... }

// New:
if (adapter.isSessionStart(stdin) && adapter.generateContext) {
  const context = adapter.generateContext();
  if (context) process.stdout.write(context);
  process.exit(0);
}
```

This way each adapter decides from the stdin JSON whether this invocation is a SessionStart event or a tool-use event. The same `agent-term hook --agent <name>` command handles both — the stdin payload determines the behavior.

### `isSessionStart(stdin)` Per Adapter

**Claude Code**: SessionStart stdin contains `"event": "SessionStart"` at the top level. Check for this field:
```typescript
isSessionStart(stdin: string): boolean {
  try {
    const data = JSON.parse(stdin);
    return data.event === 'SessionStart';
  } catch { return false; }
}
```

**Gemini CLI**: SessionStart stdin contains `"hook_event_name": "SessionStart"`:
```typescript
isSessionStart(stdin: string): boolean {
  try {
    const data = JSON.parse(stdin);
    return data.hook_event_name === 'SessionStart';
  } catch { return false; }
}
```

**Codex CLI**: Only fires on SessionStart (context mode), so always returns true:
```typescript
isSessionStart(_stdin: string): boolean {
  return true;
}
```

**Fallback**: If parsing fails or field is missing, returns `false` → falls through to `processHook()` → empty command → passthrough. Safe default.

### `hookMode` Cleanup

Remove `hookMode` from the `AgentAdapter` interface and all adapters. It's replaced by `isSessionStart()`. Remove the `HookMode` type.

### Shared Context Module

New file `src/adapters/context.ts`:

```typescript
import { listSessionNames, getSessionStatus, getSessionCommand } from '../tmux.js';
import { fromSessionName } from '../naming.js';

export function buildContextText(): string {
  // 1. Header: agent-term is installed, all commands route through tmux
  // 2. Active terminals list (name, status, command) — with try/catch
  // 3. Usage: agent-term logs/send/kill/list/status commands
  // 4. Guidance: "Do NOT run long-running commands directly"
}
```

Returns a plain text string. All three adapters call this from their `generateContext()`. The Codex adapter's current inline logic moves here.

### Context Output Format

- **Claude Code**: `generateContext()` returns plain text. Written directly to stdout in `runHook`. No JSON wrapping — Claude Code SessionStart hooks accept plain text on stdout with exit code 0.
- **Gemini CLI**: Same — `generateContext()` returns plain text, written to stdout. Gemini CLI SessionStart hooks also accept plain text.
- **Codex CLI**: No change — already works this way.

No temp files involved. Context injection does not go through `formatHookOutput()`.

### Hook Registration

**Claude Code** `register()` — adds two hook entries:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "agent-term hook --agent claude-code"
        }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "agent-term hook --agent claude-code",
          "timeout": 15
        }]
      }
    ]
  }
}
```

Duplicate detection checks both `SessionStart` and `PreToolUse` arrays for existing `agent-term` entries. Calling `register()` twice is idempotent.

**Gemini CLI** `register()` — adds two hook entries:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{
          "name": "agent-term",
          "type": "command",
          "command": "agent-term hook --agent gemini-cli"
        }]
      }
    ],
    "BeforeTool": [
      {
        "matcher": "run_shell_command",
        "hooks": [{
          "name": "agent-term",
          "type": "command",
          "command": "agent-term hook --agent gemini-cli",
          "timeout": 15000
        }]
      }
    ]
  }
}
```

No `matcher` on SessionStart — it fires unconditionally. Duplicate detection checks both arrays.

### Unregister

Both adapters' `unregister()` remove agent-term entries from both hook event arrays (SessionStart + PreToolUse/BeforeTool).

### Edge Cases

- **No active terminals**: Context still injected with usage instructions
- **tmux not running**: `buildContextText()` catches errors, shows "No active terminals"
- **SessionStart fires on resume/clear**: Fresh terminal list re-injected — desirable
- **Malformed stdin**: `isSessionStart()` returns `false`, falls through to processHook, empty command → passthrough
- **Empty stdin**: Same safe fallback

### Test Impact

- Tests for `context.ts` — new unit tests for `buildContextText()`
- Tests for `hook.ts` — update to use `isSessionStart` instead of `hookMode`
- Tests for Claude Code / Gemini CLI adapters — add tests for `isSessionStart()`, `generateContext()`, updated `register()`/`unregister()`
- Tests for Codex CLI — update `generateContext()` to use shared module, add `isSessionStart()` test
- Remove references to `hookMode` from all tests
