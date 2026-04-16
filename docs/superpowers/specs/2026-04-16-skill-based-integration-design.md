# Skill-based integration (v1.0.0)

**Date:** 2026-04-16
**Status:** Approved
**Supersedes:** hook-based integration from `2026-03-23-agent-term-design.md`, `2026-03-24-universal-tmux-hook-design.md`, `2026-03-24-session-context-injection-design.md`

## Motivation

The current hook-based integration runs `agent-term hook` on every `Bash` / `run_shell_command` tool call across Claude Code, Codex CLI, and Gemini CLI. This imposes a PreToolUse roundtrip on *every* shell command the agent runs — including one-shot commands that have nothing to do with long-running processes — and relies on a brittle regex list (`LONG_RUNNING_PATTERNS`) to decide when to route into tmux.

All three supported agents now expose a first-class **skills** mechanism: a user-level `SKILL.md` file with `name` + `description` frontmatter that the agent auto-invokes based on task context. This is a better fit for agent-term's actual value proposition (keeping persistent processes alive across sessions), because the agent itself decides when to reach for the skill based on the task at hand, with zero per-command overhead.

This change removes the hook machinery entirely and replaces it with a single bundled `SKILL.md` installed into each detected agent's skill directory.

## Scope

**In scope:**

- Remove the `agent-term hook` command, the `processHook` logic, and all hook-related adapter surface area.
- Replace hook registration with skill installation across all three adapters (Claude Code, Codex CLI, Gemini CLI).
- Ship a bundled `SKILL.md` as a package asset.
- Migrate existing users on `agent-term init` by detecting and removing legacy hook entries from their agent config files.
- Bump to `1.0.0` (breaking change: the `hook` command is gone).
- Update README, CHANGELOG, and tests.

**Out of scope:**

- Changing the tmux-backed terminal lifecycle (`start`, `logs`, `send`, `kill`, `restart`, `status`, `list`). These are unchanged.
- Adding new platforms. Claude Code / Codex CLI / Gemini CLI support stays as-is.
- Automatic classification of "long-running" commands. That was a workaround for the hook model; with skills, the agent decides when to invoke agent-term, and the skill description guides that decision.

## Skill activation boundary

The `description:` field in the SKILL.md frontmatter is the only signal all three agents use to auto-invoke. It must:

- **Name concrete triggers.** Dev servers (`npm/pnpm/yarn run dev`, `next dev`, `vite`, `uvicorn`, `rails server`), file watchers, `tail -f`, ngrok/cloudflared tunnels, log streamers, queue workers, daemons.
- **Cover both start-time and management-time intent.** Starting a process, checking output, restarting, killing.
- **State explicit negatives.** Not for builds, tests, installs, or one-shot scripts. Without this, the skill gets pulled into unrelated slow commands.

## Architecture

### Bundled asset

Single source of truth lives in the package source tree at `src/assets/SKILL.md`. `tsc` does not copy non-TS files, so the build pipeline needs a `copy:assets` step that mirrors `src/assets/` into `dist/assets/` before `npm publish`. Adapters resolve the asset path relative to the compiled CLI location (`dist/assets/SKILL.md`).

The `package.json` `files` array must include `dist` (already does) and also the assets — verify they land in the published tarball.

### Adapter interface (revised)

The `AgentAdapter` interface collapses significantly. New shape:

```ts
export interface AgentAdapter {
  name: string;
  displayName: string;
  skillPath: string;          // absolute path to ~/.<agent>/skills/agent-term/SKILL.md
  configPath: string;         // absolute path to the agent's legacy config file (for migration only)
  detect(): boolean;
  installSkill(): void;       // idempotent: creates skill dir, copies SKILL.md
  uninstallSkill(): void;     // removes the skill directory
  removeLegacyHooks(): { removed: boolean };  // migration: strips agent-term hooks from config
}
```

Everything removed from the old interface:

- `register()` → replaced by `installSkill()`
- `unregister()` → replaced by `uninstallSkill()`
- `parseHookInput`, `formatHookOutput`, `isSessionStart`, `generateContext` → gone entirely (no more hooks).
- `HookInput`, `HookResult` types → gone.

### Per-adapter skill paths

| Adapter | Skill directory | Legacy hook config |
|---|---|---|
| `claude-code` | `~/.claude/skills/agent-term/` | `~/.claude/settings.json` (`hooks.PreToolUse`, `hooks.SessionStart`) |
| `codex-cli` | `${CODEX_HOME:-~/.codex}/skills/agent-term/` | `~/.codex/config.toml` (`[[hooks]]` block with `event = "SessionStart"`) |
| `gemini-cli` | `~/.gemini/skills/agent-term/` | `~/.gemini/settings.json` (`hooks.BeforeTool`, `hooks.SessionStart`) |

`installSkill()` creates the skill directory and writes `SKILL.md` by copying from the bundled asset. Idempotent — overwriting an existing file is fine and keeps the shipped skill in sync with the package version.

`removeLegacyHooks()` reuses the logic from the current `unregister()` implementations (filter any entry whose `command` string contains `agent-term`). Returns whether anything was actually removed so `init` can report the migration.

## `agent-term init` flow (revised)

```
intro
  ↓
tmux check                           (unchanged)
  ↓
detect installed agents              (unchanged)
  ↓
multiselect which agents to configure  (unchanged)
  ↓
for each selected adapter:
  1. adapter.removeLegacyHooks()  →  if removed, note "Migrated: removed legacy hooks from <configPath>"
  2. adapter.installSkill()       →  note "Installed skill at <skillPath>"
  ↓
outro
```

Migration is automatic and silent-on-empty: if no legacy hooks exist, nothing is reported and nothing is changed. Users upgrading from 0.x get their hooks stripped on the first `init` run.

**Non-interactive mode** (`--non-interactive --agents <names>`) follows the same two-step flow per adapter.

## SKILL.md content (body)

The frontmatter description is the trigger. The body teaches the agent how to use agent-term correctly. Required sections:

1. **Check first.** Always run `agent-term list` before starting anything, so the agent doesn't spawn a duplicate of an already-running dev server.
2. **Start, don't background.** Use `agent-term start --name <name> -- <command>` instead of the native tool's `run_in_background` equivalent. Explain why (shared across sessions, inspectable, survives agent restart).
3. **Naming conventions.** Lowercase, hyphenated, project-prefixed (`macroflow-api`, `macroflow-app`). Avoid generic names like `dev` or `server`.
4. **Reading output.** `agent-term logs <name>`, `--lines <n>` for more.
5. **Lifecycle.** `status`, `send` (for TTY input like `rs` to nodemon), `restart`, `kill`.
6. **When NOT to use.** Builds, tests, installs, any command that terminates on its own.

The body must be imperative ("use", "check", "avoid") and tight — the agent is loading this into context, not the user.

## Commands to remove

From `src/cli.ts`: the `hook` subcommand registration.

Files deleted entirely:

- `src/commands/hook.ts`
- `src/adapters/context.ts`
- `tests/hook.test.ts`
- `tests/context.test.ts`

The `isLongRunning` helper and `LONG_RUNNING_PATTERNS` regex list are deleted with `hook.ts` — they don't have a home in the skill-based model. The skill description replaces them.

## Tests

New tests per adapter (`claude-code.test.ts`, `codex-cli.test.ts`, `gemini-cli.test.ts`):

- `installSkill()` writes `SKILL.md` at the expected path with expected frontmatter.
- `installSkill()` is idempotent — calling twice doesn't error, second call overwrites.
- `uninstallSkill()` removes the skill directory cleanly.
- `removeLegacyHooks()` strips only agent-term entries, leaves unrelated hooks/user-defined entries untouched.
- `removeLegacyHooks()` on a config with no agent-term entries returns `{ removed: false }` and does not modify the file.

Existing tests kept as-is: `tmux.test.ts`, `naming.test.ts`, `registry.test.ts`, `commands.test.ts` (for non-hook commands).

Existing tests deleted: `hook.test.ts`, `context.test.ts`.

## Docs

- **README.md** — rewrite the "How it works" section. Remove hook references. Describe skill auto-activation. Update install/usage to show `agent-term init` installing the skill.
- **CHANGELOG.md** — `1.0.0` entry with the breaking change call-out and migration note ("Run `agent-term init` to migrate from 0.x hooks to skills").
- **docs/** — audit for stale hook references. The prior spec files (`2026-03-23-agent-term-design.md`, `2026-03-24-universal-tmux-hook-design.md`, `2026-03-24-session-context-injection-design.md`) should stay as historical record with a "Superseded by" note linking here, not be deleted.

## Version

`1.0.0`. Breaking change: the `hook` subcommand is removed. Users with pinned versions of agent-term that still call `hook` (unlikely outside the agent config files we manage) will break; `init` handles the config migration.

## Acceptance criteria

- `agent-term init` on a fresh machine installs `SKILL.md` into each selected agent's skills directory and registers no hooks.
- `agent-term init` on a machine with existing 0.4.x hooks removes those hooks from the agent's config *and* installs the skill, reporting both actions.
- The `hook` subcommand is absent from `agent-term --help`.
- Running `agent-term` as an agent-visible tool from within Claude Code / Codex CLI / Gemini CLI shows no PreToolUse / BeforeTool / SessionStart latency attributable to agent-term.
- When the user tells the agent to "start the dev server", the agent consults the agent-term skill and uses `agent-term start` rather than backgrounding the command natively.
- When the user asks a one-shot question like "run `git status`", the agent does NOT invoke the agent-term skill.
- `pnpm test` passes with all new and retained tests.
