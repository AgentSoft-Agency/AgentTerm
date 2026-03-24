# Gemini CLI Adapter for agent-term

**Date:** 2026-03-24
**Status:** Approved
**Approach:** Mirror Claude Code adapter pattern (Approach A)

## Context

agent-term centralizes long-running terminal processes in shared tmux sessions. It intercepts commands via agent-specific pre-hooks and routes matching commands to tmux. The Claude Code adapter is fully implemented; the Gemini CLI adapter is a stub. Gemini CLI's hook system is now documented and closely mirrors Claude Code's, making a 1:1 adapter implementation viable.

## Gemini CLI Hook System Summary

- **11 hook events** — we use `BeforeTool` (equivalent to Claude Code's `PreToolUse`)
- **JSON stdin/stdout protocol** — same contract as Claude Code
- **Exit codes:** 0 (success), 2 (block), other (non-fatal warning)
- **Config location:** `~/.gemini/settings.json` under `hooks` key
- **Shell tool name:** `run_shell_command` (equivalent to Claude Code's `Bash`)
- **Timeout units:** milliseconds (Claude Code uses seconds)
- **Hook naming:** Gemini supports a `name` field for in-CLI management (`/hooks enable/disable`)

## Design

### Detection

Check `~/.gemini/` directory exists. Already implemented in stub — no change needed.

- `configPath`: `~/.gemini/settings.json`

### Hook Registration

Write to `~/.gemini/settings.json` under `hooks.BeforeTool`:

```json
{
  "hooks": {
    "BeforeTool": [
      {
        "matcher": "run_shell_command",
        "hooks": [
          {
            "name": "agent-term",
            "type": "command",
            "command": "agent-term hook --agent gemini-cli",
            "timeout": 15000
          }
        ]
      }
    ]
  }
}
```

**Merge strategy:** Read existing config, deep-merge hooks array, preserve all other settings. If an `agent-term` hook already exists in `BeforeTool`, skip registration.

**Differences from Claude Code registration:**
- Event key: `BeforeTool` (not `PreToolUse`)
- Matcher: `"run_shell_command"` (not `"Bash"`)
- Timeout: `15000` ms (not `15` seconds)
- Includes `name: "agent-term"` field for Gemini's hook management

### Input Parsing

Expected `BeforeTool` stdin from Gemini CLI:

```json
{
  "session_id": "abc123",
  "hook_event_name": "BeforeTool",
  "tool_name": "run_shell_command",
  "tool_input": { "command": "pnpm dev" },
  "cwd": "/path/to/project",
  "transcript_path": "/path/to/transcript",
  "timestamp": "2026-03-24T12:00:00Z"
}
```

Extraction mapping:
- `tool_input.command` → `HookInput.command`
- `session_id` → `HookInput.sessionId`

All other fields (`hook_event_name`, `cwd`, `transcript_path`, `timestamp`, `tool_name`) are ignored — same approach as Claude Code adapter.

**Error handling:** Invalid JSON or missing `tool_input.command` → return `{ command: '' }` (triggers passthrough in hook logic).

### Output Formatting

**Passthrough** (no match): return empty string. Hook exits 0 with no stdout — Gemini CLI proceeds normally.

**Rewrite** (match found):

```json
{
  "decision": "allow",
  "hookSpecificOutput": {
    "tool_input": {
      "command": "agent-term start --name pnpm-dev -- pnpm dev"
    }
  },
  "systemMessage": "Command routed to shared terminal 'pnpm-dev' via agent-term."
}
```

**Differences from Claude Code output:**
- Top-level `decision: "allow"` field (Claude Code omits this — implicit from exit 0)
- `hookSpecificOutput.tool_input` (not `hookSpecificOutput.updatedInput`) — Gemini merges this into the tool's arguments
- No `permissionDecision` field (Gemini doesn't use this concept)

### Unregistration

Remove any hook entries in `hooks.BeforeTool` where a nested hook's `command` contains `"agent-term"`. Preserve all other hooks. Same defensive pattern as Claude Code.

If `BeforeTool` array becomes empty after removal, remove the key entirely.

### README Update

Update the agent support table:

```
| Agent | Status |
|-------|--------|
| Claude Code | Fully supported |
| Gemini CLI | Fully supported |
| Codex CLI | Stub (adapter ready, hook format TBD) |
```

## Test Plan

Mirror `claude-code.test.ts` structure in a new `gemini-cli.test.ts`:

### Input Parsing Tests
- Valid BeforeTool JSON → extracts command and sessionId
- Missing tool_input → returns empty command
- Missing tool_input.command → returns empty command
- Malformed JSON → returns empty command
- Extra fields ignored gracefully

### Output Formatting Tests
- Passthrough result → empty string
- Rewrite result → valid JSON with decision, hookSpecificOutput.tool_input, systemMessage
- Rewrite JSON is parseable and fields match expected structure

### Registration Tests
- Empty/missing settings.json → creates file with hook config
- Existing settings with no hooks → adds hooks key
- Existing hooks with other events → adds BeforeTool without clobbering
- Existing BeforeTool with other matchers → appends run_shell_command matcher
- Already registered → skips (no duplicate)

### Unregistration Tests
- Removes agent-term hook entry
- Preserves other hooks in BeforeTool
- Handles missing hooks/BeforeTool gracefully
- Cleans up empty BeforeTool array

## Assumptions

1. **`tool_input.command`** is the field Gemini CLI uses for `run_shell_command` arguments. This follows the same pattern as Claude Code and is the natural field name. If it differs, only `parseHookInput()` and `formatHookOutput()` need adjustment.
2. **`decision: "allow"`** should be included in rewrite output for explicitness, even though exit 0 may imply it.
3. **User-level config** (`~/.gemini/settings.json`) is the right place for registration, not project-level (`.gemini/settings.json`), since agent-term is a global tool.

## Files Changed

- `src/adapters/gemini-cli.ts` — Replace stub with full implementation
- `tests/gemini-cli.test.ts` — New test file
- `README.md` — Update status table
