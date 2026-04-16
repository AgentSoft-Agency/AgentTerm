# agent-term v1.0.0 — Skill-based Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace agent-term's hook-based integration with a unified SKILL.md installed into each supported agent's skills directory.

**Architecture:** Bundle a single `SKILL.md` asset in the package. Each `AgentAdapter` (Claude Code, Codex CLI, Gemini CLI) implements `installSkill()`, `uninstallSkill()`, and `removeLegacyHooks()`. `agent-term init` detects installed agents, strips legacy hooks from their config files, and copies the skill into their skills directory. The `hook` subcommand and all hook-processing logic are removed.

**Tech Stack:** TypeScript (strict, ES2022, Node16 modules), vitest, node:fs, commander, @clack/prompts, standard-version.

**Spec:** `docs/superpowers/specs/2026-04-16-skill-based-integration-design.md`

---

## File Structure

**New files:**
- `src/assets/SKILL.md` — bundled skill file shipped with package
- `scripts/copy-assets.mjs` — build-time asset copy
- `tests/skill-asset.test.ts` — asserts asset is readable and has required frontmatter

**Modified files:**
- `package.json` — add `copy:assets` script, chain into `build`; bump version; ensure assets ship
- `src/cli.ts` — remove `hook` subcommand
- `src/adapters/adapter.ts` — collapsed interface
- `src/adapters/claude-code.ts` — skill install + legacy hook removal
- `src/adapters/codex-cli.ts` — same
- `src/adapters/gemini-cli.ts` — same
- `src/commands/init.ts` — install skill + migrate hooks flow
- `tests/claude-code.test.ts` — replace hook tests with skill tests
- `tests/codex-cli.test.ts` — same
- `tests/gemini-cli.test.ts` — same
- `README.md` — rewrite "How it works" section
- `CHANGELOG.md` — `1.0.0` entry (via `standard-version`)

**Deleted files:**
- `src/commands/hook.ts`
- `src/adapters/context.ts`
- `tests/hook.test.ts`
- `tests/context.test.ts`

---

### Task 1: Add bundled SKILL.md asset

**Files:**
- Create: `src/assets/SKILL.md`

- [ ] **Step 1: Create the assets directory and write SKILL.md**

Create `src/assets/SKILL.md` with this exact content:

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add src/assets/SKILL.md
git commit -m "feat(assets): add bundled SKILL.md for skill-based integration"
```

---

### Task 2: Add asset copy build step

**Files:**
- Create: `scripts/copy-assets.mjs`
- Modify: `package.json` (scripts, files)

- [ ] **Step 1: Write the copy script**

Create `scripts/copy-assets.mjs`:

```js
#!/usr/bin/env node
import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'src/assets');
const dest = resolve(root, 'dist/assets');

await mkdir(dirname(dest), { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`Copied assets: ${src} -> ${dest}`);
```

- [ ] **Step 2: Wire into package.json**

In `package.json`:

- Change `"build": "tsc"` to `"build": "tsc && node scripts/copy-assets.mjs"`.
- Add `"copy:assets": "node scripts/copy-assets.mjs"` to `scripts`.
- No change needed to `files` — `dist` already covers everything `build` emits.

- [ ] **Step 3: Run build and verify**

```bash
cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term
pnpm build
ls dist/assets/SKILL.md
```

Expected: `dist/assets/SKILL.md` exists.

- [ ] **Step 4: Commit**

```bash
git add scripts/copy-assets.mjs package.json
git commit -m "build: copy src/assets into dist during build"
```

---

### Task 3: Add skill-asset test

**Files:**
- Create: `tests/skill-asset.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/skill-asset.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('bundled SKILL.md', () => {
  const assetPath = resolve(__dirname, '../src/assets/SKILL.md');
  const content = readFileSync(assetPath, 'utf-8');

  it('exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  it('has YAML frontmatter with name and description', () => {
    expect(content.startsWith('---\n')).toBe(true);
    expect(content).toMatch(/\nname:\s*agent-term\s*\n/);
    expect(content).toMatch(/\ndescription:\s*.+\n/);
  });

  it('description names concrete long-running triggers', () => {
    expect(content).toMatch(/dev servers?/i);
    expect(content).toMatch(/watcher/i);
    expect(content).toMatch(/tail -f/);
    expect(content).toMatch(/daemon|tunnel/i);
  });

  it('description includes negative examples', () => {
    expect(content).toMatch(/DO NOT use for|not for|Do not use/);
    expect(content).toMatch(/build|test|install/i);
  });

  it('body teaches list-before-start discipline', () => {
    expect(content).toContain('agent-term list');
    expect(content).toContain('agent-term start');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
pnpm test -- tests/skill-asset.test.ts
```

Expected: 5 tests PASS (the asset was written in Task 1).

- [ ] **Step 3: Commit**

```bash
git add tests/skill-asset.test.ts
git commit -m "test: verify bundled SKILL.md frontmatter and body"
```

---

### Task 4: Demolition — remove hook code and collapse adapter interface

This is the one heavy task. It deletes all hook machinery in a single commit so the remaining codebase stays type-safe and tests keep passing. Subsequent tasks TDD the new surface back on, one adapter at a time.

**Files:**
- Delete: `src/commands/hook.ts`
- Delete: `src/adapters/context.ts`
- Delete: `tests/hook.test.ts`
- Delete: `tests/context.test.ts`
- Modify: `src/cli.ts`
- Modify: `src/adapters/adapter.ts`
- Modify: `src/adapters/claude-code.ts`
- Modify: `src/adapters/codex-cli.ts`
- Modify: `src/adapters/gemini-cli.ts`
- Modify: `tests/claude-code.test.ts`
- Modify: `tests/codex-cli.test.ts`
- Modify: `tests/gemini-cli.test.ts`
- Modify: `src/commands/init.ts`

- [ ] **Step 1: Delete the hook files and their tests**

```bash
cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term
rm src/commands/hook.ts
rm src/adapters/context.ts
rm tests/hook.test.ts
rm tests/context.test.ts
```

- [ ] **Step 2: Remove the `hook` subcommand from cli.ts**

In `src/cli.ts`, delete lines 21–28 (the entire `program.command('hook')` block including its `.action(...)`).

The final `src/cli.ts` keeps `init`, `start`, `logs`, `send`, `kill`, `restart`, `status`, `list` — everything except `hook`.

- [ ] **Step 3: Collapse the AgentAdapter interface**

Replace the entire contents of `src/adapters/adapter.ts` with:

```ts
export interface AgentAdapter {
  name: string;
  displayName: string;
  /** Absolute path to the directory where SKILL.md is installed. */
  skillPath: string;
  /** Absolute path to the agent's legacy config file (used only for hook migration). */
  configPath: string;
  detect(): boolean;
  /** Copies the bundled SKILL.md into skillPath. Idempotent. */
  installSkill(): void;
  /** Removes the installed skill directory. Idempotent. */
  uninstallSkill(): void;
  /** Strips legacy agent-term hooks from the agent's config. Returns whether anything was removed. */
  removeLegacyHooks(): { removed: boolean };
}
```

- [ ] **Step 4: Replace ClaudeCodeAdapter with a stub**

Replace the entire contents of `src/adapters/claude-code.ts` with:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter } from './adapter.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');
const SKILL_DIR = join(CLAUDE_DIR, 'skills', 'agent-term');

export class ClaudeCodeAdapter implements AgentAdapter {
  name = 'claude-code';
  displayName = 'Claude Code';
  skillPath = SKILL_DIR;
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(CLAUDE_DIR);
  }

  installSkill(): void {
    throw new Error('not implemented');
  }

  uninstallSkill(): void {
    throw new Error('not implemented');
  }

  removeLegacyHooks(): { removed: boolean } {
    throw new Error('not implemented');
  }
}
```

- [ ] **Step 5: Replace CodexCliAdapter with a stub**

Replace the entire contents of `src/adapters/codex-cli.ts` with:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter } from './adapter.js';

const CODEX_DIR = process.env.CODEX_HOME ?? join(homedir(), '.codex');
const CONFIG_PATH = join(CODEX_DIR, 'config.toml');
const SKILL_DIR = join(CODEX_DIR, 'skills', 'agent-term');

export class CodexCliAdapter implements AgentAdapter {
  name = 'codex-cli';
  displayName = 'Codex CLI';
  skillPath = SKILL_DIR;
  configPath = CONFIG_PATH;

  detect(): boolean {
    return existsSync(CODEX_DIR);
  }

  installSkill(): void {
    throw new Error('not implemented');
  }

  uninstallSkill(): void {
    throw new Error('not implemented');
  }

  removeLegacyHooks(): { removed: boolean } {
    throw new Error('not implemented');
  }
}
```

- [ ] **Step 6: Replace GeminiCliAdapter with a stub**

Replace the entire contents of `src/adapters/gemini-cli.ts` with:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter } from './adapter.js';

const GEMINI_DIR = join(homedir(), '.gemini');
const SETTINGS_PATH = join(GEMINI_DIR, 'settings.json');
const SKILL_DIR = join(GEMINI_DIR, 'skills', 'agent-term');

export class GeminiCliAdapter implements AgentAdapter {
  name = 'gemini-cli';
  displayName = 'Gemini CLI';
  skillPath = SKILL_DIR;
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(GEMINI_DIR);
  }

  installSkill(): void {
    throw new Error('not implemented');
  }

  uninstallSkill(): void {
    throw new Error('not implemented');
  }

  removeLegacyHooks(): { removed: boolean } {
    throw new Error('not implemented');
  }
}
```

- [ ] **Step 7: Replace init.ts with a stub**

Replace the entire contents of `src/commands/init.ts` with:

```ts
import { intro, outro, multiselect, note, isCancel, cancel } from '@clack/prompts';
import { isTmuxInstalled } from '../tmux.js';
import { getAllAdapters, detectInstalledAgents } from '../adapters/registry.js';

export async function runInit(options: { nonInteractive?: boolean; agents?: string }): Promise<void> {
  if (options.nonInteractive) {
    return runNonInteractive(options.agents);
  }

  intro('agent-term init');

  if (!isTmuxInstalled()) {
    const platform = process.platform;
    const installCmd = platform === 'darwin' ? 'brew install tmux' : 'sudo apt install tmux';
    note(`tmux is required but not installed.\n\nInstall it with:\n  ${installCmd}`, 'Missing dependency');
    process.exit(1);
  }

  const allAdapters = getAllAdapters();
  const detected = detectInstalledAgents();

  if (allAdapters.length === 0) {
    note('No agent adapters available.', 'Agents');
    outro('Setup complete.');
    return;
  }

  const optionsList = allAdapters.map((a) => ({
    value: a.name,
    label: `${a.displayName}${detected.some((d) => d.name === a.name) ? '' : ' (not detected)'}`,
    hint: a.skillPath,
  }));

  const selected = await multiselect({
    message: `Found ${detected.length} agent(s) installed. Select which to configure:`,
    options: optionsList,
    initialValues: detected.map((a) => a.name),
    required: false,
  });

  if (isCancel(selected)) { cancel('Setup cancelled.'); process.exit(0); }

  const selectedAdapters = allAdapters.filter((a) => (selected as string[]).includes(a.name));

  for (const adapter of selectedAdapters) {
    const { removed } = adapter.removeLegacyHooks();
    if (removed) {
      note(`Removed legacy hooks from ${adapter.configPath}`, adapter.displayName);
    }
    adapter.installSkill();
    note(`Installed skill at ${adapter.skillPath}`, adapter.displayName);
  }

  outro(`agent-term configured for ${selectedAdapters.length} agent(s). Run 'agent-term list' to see shared terminals.`);
}

async function runNonInteractive(agentNames?: string): Promise<void> {
  if (!isTmuxInstalled()) {
    console.error('Error: tmux is not installed.');
    process.exit(1);
  }

  if (agentNames) {
    const names = agentNames.split(',').map((n) => n.trim());
    const allAdapters = getAllAdapters();
    for (const name of names) {
      const adapter = allAdapters.find((a) => a.name === name);
      if (adapter) {
        const { removed } = adapter.removeLegacyHooks();
        if (removed) console.log(`Removed legacy hooks for ${adapter.displayName}`);
        adapter.installSkill();
        console.log(`Installed skill for ${adapter.displayName}`);
      } else {
        console.warn(`Warning: unknown agent '${name}'`);
      }
    }
  }

  console.log('agent-term setup complete.');
}
```

- [ ] **Step 8: Replace tests/claude-code.test.ts with a minimal metadata-only suite**

Replace the entire contents of `tests/claude-code.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.js';

describe('ClaudeCodeAdapter metadata', () => {
  const adapter = new ClaudeCodeAdapter();

  it('has correct name and displayName', () => {
    expect(adapter.name).toBe('claude-code');
    expect(adapter.displayName).toBe('Claude Code');
  });

  it('resolves skillPath under ~/.claude/skills/agent-term', () => {
    expect(adapter.skillPath).toBe(join(homedir(), '.claude', 'skills', 'agent-term'));
  });

  it('resolves configPath to ~/.claude/settings.json', () => {
    expect(adapter.configPath).toBe(join(homedir(), '.claude', 'settings.json'));
  });
});
```

- [ ] **Step 9: Replace tests/codex-cli.test.ts with a minimal metadata-only suite**

Replace the entire contents of `tests/codex-cli.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CodexCliAdapter } from '../src/adapters/codex-cli.js';

describe('CodexCliAdapter metadata', () => {
  const adapter = new CodexCliAdapter();

  it('has correct name and displayName', () => {
    expect(adapter.name).toBe('codex-cli');
    expect(adapter.displayName).toBe('Codex CLI');
  });

  it('resolves skillPath under ~/.codex/skills/agent-term', () => {
    const expected = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'skills', 'agent-term');
    expect(adapter.skillPath).toBe(expected);
  });

  it('resolves configPath to ~/.codex/config.toml', () => {
    const expected = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'config.toml');
    expect(adapter.configPath).toBe(expected);
  });
});
```

- [ ] **Step 10: Replace tests/gemini-cli.test.ts with a minimal metadata-only suite**

Replace the entire contents of `tests/gemini-cli.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { GeminiCliAdapter } from '../src/adapters/gemini-cli.js';

describe('GeminiCliAdapter metadata', () => {
  const adapter = new GeminiCliAdapter();

  it('has correct name and displayName', () => {
    expect(adapter.name).toBe('gemini-cli');
    expect(adapter.displayName).toBe('Gemini CLI');
  });

  it('resolves skillPath under ~/.gemini/skills/agent-term', () => {
    expect(adapter.skillPath).toBe(join(homedir(), '.gemini', 'skills', 'agent-term'));
  });

  it('resolves configPath to ~/.gemini/settings.json', () => {
    expect(adapter.configPath).toBe(join(homedir(), '.gemini', 'settings.json'));
  });
});
```

- [ ] **Step 11: Build and test**

```bash
pnpm build
pnpm test
```

Expected: build succeeds. All tests pass. (Hook tests are deleted, adapter tests are reduced to metadata, skill-asset test still passes, tmux/naming/registry/commands tests unchanged.)

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor!: remove hook machinery, collapse AgentAdapter to skill surface

BREAKING CHANGE: the 'agent-term hook' subcommand is removed. The
adapter interface drops parseHookInput, formatHookOutput, isSessionStart,
generateContext, register, unregister in favor of installSkill,
uninstallSkill, removeLegacyHooks. Stubs throw until wired up in
subsequent commits."
```

---

### Task 5: Implement ClaudeCodeAdapter.installSkill (TDD)

**Files:**
- Modify: `tests/claude-code.test.ts`
- Modify: `src/adapters/claude-code.ts`

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/claude-code.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn((path: string, enc: string) => {
      if (String(path).endsWith('src/assets/SKILL.md')) {
        return '---\nname: agent-term\ndescription: test\n---\nBody';
      }
      return actual.readFileSync(path as any, enc as any);
    }),
  };
});

describe('ClaudeCodeAdapter metadata', () => {
  const adapter = new ClaudeCodeAdapter();

  it('has correct name and displayName', () => {
    expect(adapter.name).toBe('claude-code');
    expect(adapter.displayName).toBe('Claude Code');
  });

  it('resolves skillPath under ~/.claude/skills/agent-term', () => {
    expect(adapter.skillPath).toBe(join(homedir(), '.claude', 'skills', 'agent-term'));
  });

  it('resolves configPath to ~/.claude/settings.json', () => {
    expect(adapter.configPath).toBe(join(homedir(), '.claude', 'settings.json'));
  });
});

describe('ClaudeCodeAdapter.installSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the skill directory and writes SKILL.md', () => {
    const adapter = new ClaudeCodeAdapter();

    adapter.installSkill();

    expect(mkdirSync).toHaveBeenCalledWith(adapter.skillPath, { recursive: true });
    expect(writeFileSync).toHaveBeenCalledOnce();
    const [target, body] = vi.mocked(writeFileSync).mock.calls[0];
    expect(String(target)).toBe(join(adapter.skillPath, 'SKILL.md'));
    expect(String(body)).toContain('name: agent-term');
  });

  it('is idempotent (overwrites existing file without error)', () => {
    const adapter = new ClaudeCodeAdapter();

    adapter.installSkill();
    adapter.installSkill();

    expect(writeFileSync).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- tests/claude-code.test.ts
```

Expected: `ClaudeCodeAdapter.installSkill` tests FAIL with `Error: not implemented`. Metadata tests still PASS.

- [ ] **Step 3: Implement installSkill**

In `src/adapters/claude-code.ts`, at the top add:

```ts
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
```

(Replace the existing `import { existsSync } from 'node:fs';` with the combined set.)

Add a helper at module scope (after the constants):

```ts
function readBundledSkill(): string {
  // In dist: .../dist/adapters/claude-code.js → ../assets/SKILL.md
  // In src (vitest): .../src/adapters/claude-code.ts → ../assets/SKILL.md
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '..', 'assets', 'SKILL.md'), 'utf-8');
}
```

Replace the body of `installSkill()`:

```ts
installSkill(): void {
  mkdirSync(this.skillPath, { recursive: true });
  const body = readBundledSkill();
  writeFileSync(join(this.skillPath, 'SKILL.md'), body, 'utf-8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- tests/claude-code.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/claude-code.ts tests/claude-code.test.ts
git commit -m "feat(claude-code): implement installSkill"
```

---

### Task 6: Implement ClaudeCodeAdapter.uninstallSkill (TDD)

**Files:**
- Modify: `tests/claude-code.test.ts`
- Modify: `src/adapters/claude-code.ts`

- [ ] **Step 1: Write the failing test**

Append to the test file, after the `installSkill` describe block:

```ts
describe('ClaudeCodeAdapter.uninstallSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes the skill directory recursively', async () => {
    const { rmSync } = await import('node:fs');
    const adapter = new ClaudeCodeAdapter();

    adapter.uninstallSkill();

    expect(rmSync).toHaveBeenCalledWith(adapter.skillPath, { recursive: true, force: true });
  });
});
```

Update the `vi.mock('node:fs', ...)` block at the top of the file to also mock `rmSync`:

```ts
    rmSync: vi.fn(),
```

(Insert into the returned object alongside `mkdirSync` and `writeFileSync`.)

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- tests/claude-code.test.ts
```

Expected: `uninstallSkill` test FAILS with `Error: not implemented`.

- [ ] **Step 3: Implement uninstallSkill**

Add `rmSync` to the `node:fs` import in `src/adapters/claude-code.ts`:

```ts
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
```

Replace the body of `uninstallSkill()`:

```ts
uninstallSkill(): void {
  rmSync(this.skillPath, { recursive: true, force: true });
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test -- tests/claude-code.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/claude-code.ts tests/claude-code.test.ts
git commit -m "feat(claude-code): implement uninstallSkill"
```

---

### Task 7: Implement ClaudeCodeAdapter.removeLegacyHooks (TDD)

**Files:**
- Modify: `tests/claude-code.test.ts`
- Modify: `src/adapters/claude-code.ts`

- [ ] **Step 1: Write the failing tests**

Append to the test file, after the `uninstallSkill` describe block:

```ts
describe('ClaudeCodeAdapter.removeLegacyHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { removed: false } when settings.json does not exist', () => {
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    const adapter = new ClaudeCodeAdapter();

    const result = adapter.removeLegacyHooks();

    expect(result).toEqual({ removed: false });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('returns { removed: false } when no agent-term hooks are present', () => {
    vi.mocked(readFileSync).mockImplementation((path: any, enc: any) => {
      if (String(path).endsWith('settings.json')) {
        return JSON.stringify({
          hooks: {
            PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'other-tool' }] }],
          },
        });
      }
      return '---\nname: agent-term\ndescription: test\n---\n';
    });
    const adapter = new ClaudeCodeAdapter();

    const result = adapter.removeLegacyHooks();

    expect(result).toEqual({ removed: false });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('strips agent-term entries from PreToolUse and SessionStart', () => {
    vi.mocked(readFileSync).mockImplementation((path: any, enc: any) => {
      if (String(path).endsWith('settings.json')) {
        return JSON.stringify({
          hooks: {
            PreToolUse: [
              { matcher: 'Bash', hooks: [{ type: 'command', command: 'agent-term hook --agent claude-code' }] },
              { matcher: 'Bash', hooks: [{ type: 'command', command: 'other-tool' }] },
            ],
            SessionStart: [
              { hooks: [{ type: 'command', command: 'agent-term hook --agent claude-code' }] },
            ],
          },
        });
      }
      return '---\nname: agent-term\ndescription: test\n---\n';
    });
    const adapter = new ClaudeCodeAdapter();

    const result = adapter.removeLegacyHooks();

    expect(result).toEqual({ removed: true });
    expect(writeFileSync).toHaveBeenCalledOnce();
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.hooks.PreToolUse).toHaveLength(1);
    expect(written.hooks.PreToolUse[0].hooks[0].command).toBe('other-tool');
    expect(written.hooks.SessionStart).toHaveLength(0);
  });

  it('preserves unrelated settings keys', () => {
    vi.mocked(readFileSync).mockImplementation((path: any, enc: any) => {
      if (String(path).endsWith('settings.json')) {
        return JSON.stringify({
          permissions: { allow: ['Read(**)'] },
          hooks: {
            PreToolUse: [
              { matcher: 'Bash', hooks: [{ type: 'command', command: 'agent-term hook --agent claude-code' }] },
            ],
          },
        });
      }
      return '---\n';
    });
    const adapter = new ClaudeCodeAdapter();

    adapter.removeLegacyHooks();

    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.permissions).toEqual({ allow: ['Read(**)'] });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- tests/claude-code.test.ts
```

Expected: 4 new tests FAIL with `Error: not implemented`.

- [ ] **Step 3: Implement removeLegacyHooks**

Add `existsSync` back to the imports in `src/adapters/claude-code.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
```

Replace the body of `removeLegacyHooks()`:

```ts
removeLegacyHooks(): { removed: boolean } {
  if (!existsSync(this.configPath)) return { removed: false };

  let settings: any;
  try {
    settings = JSON.parse(readFileSync(this.configPath, 'utf-8'));
  } catch {
    return { removed: false };
  }

  if (!settings?.hooks) return { removed: false };

  const isAgentTermEntry = (entry: any): boolean =>
    Array.isArray(entry?.hooks) &&
    entry.hooks.some((h: any) => typeof h?.command === 'string' && h.command.includes('agent-term'));

  let changed = false;
  for (const key of ['PreToolUse', 'SessionStart']) {
    if (!Array.isArray(settings.hooks[key])) continue;
    const before = settings.hooks[key].length;
    settings.hooks[key] = settings.hooks[key].filter((entry: any) => !isAgentTermEntry(entry));
    if (settings.hooks[key].length !== before) changed = true;
  }

  if (!changed) return { removed: false };

  writeFileSync(this.configPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  return { removed: true };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test -- tests/claude-code.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/claude-code.ts tests/claude-code.test.ts
git commit -m "feat(claude-code): implement removeLegacyHooks"
```

---

### Task 8: Implement CodexCliAdapter (all three methods, TDD)

Codex stores its config as TOML text, not JSON. The existing `unregister()` already has TOML-aware removal logic that we'll adapt.

**Files:**
- Modify: `tests/codex-cli.test.ts`
- Modify: `src/adapters/codex-cli.ts`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `tests/codex-cli.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { CodexCliAdapter } from '../src/adapters/codex-cli.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn((path: string, enc: string) => {
      if (String(path).endsWith('src/assets/SKILL.md')) {
        return '---\nname: agent-term\ndescription: test\n---\nBody';
      }
      return actual.readFileSync(path as any, enc as any);
    }),
  };
});

describe('CodexCliAdapter metadata', () => {
  const adapter = new CodexCliAdapter();

  it('has correct name and displayName', () => {
    expect(adapter.name).toBe('codex-cli');
    expect(adapter.displayName).toBe('Codex CLI');
  });

  it('resolves skillPath under ~/.codex/skills/agent-term', () => {
    const expected = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'skills', 'agent-term');
    expect(adapter.skillPath).toBe(expected);
  });

  it('resolves configPath to ~/.codex/config.toml', () => {
    const expected = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'config.toml');
    expect(adapter.configPath).toBe(expected);
  });
});

describe('CodexCliAdapter.installSkill', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates the skill directory and writes SKILL.md', () => {
    const adapter = new CodexCliAdapter();
    adapter.installSkill();

    expect(mkdirSync).toHaveBeenCalledWith(adapter.skillPath, { recursive: true });
    expect(writeFileSync).toHaveBeenCalledOnce();
    const [target, body] = vi.mocked(writeFileSync).mock.calls[0];
    expect(String(target)).toBe(join(adapter.skillPath, 'SKILL.md'));
    expect(String(body)).toContain('name: agent-term');
  });

  it('is idempotent', () => {
    const adapter = new CodexCliAdapter();
    adapter.installSkill();
    adapter.installSkill();
    expect(writeFileSync).toHaveBeenCalledTimes(2);
  });
});

describe('CodexCliAdapter.uninstallSkill', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('removes the skill directory recursively', () => {
    const adapter = new CodexCliAdapter();
    adapter.uninstallSkill();
    expect(rmSync).toHaveBeenCalledWith(adapter.skillPath, { recursive: true, force: true });
  });
});

describe('CodexCliAdapter.removeLegacyHooks', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns { removed: false } when config does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const adapter = new CodexCliAdapter();
    expect(adapter.removeLegacyHooks()).toEqual({ removed: false });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('returns { removed: false } when config has no agent-term block', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      if (String(path).endsWith('config.toml')) return '[mcp_servers]\n';
      return '---\n';
    });
    const adapter = new CodexCliAdapter();
    expect(adapter.removeLegacyHooks()).toEqual({ removed: false });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('strips the agent-term hook block and reports removed: true', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      if (String(path).endsWith('config.toml')) {
        return '[mcp_servers]\n\n# agent-term hook\n[[hooks]]\nevent = "SessionStart"\ncommand = "agent-term hook --agent codex-cli"\n';
      }
      return '---\n';
    });
    const adapter = new CodexCliAdapter();

    const result = adapter.removeLegacyHooks();

    expect(result).toEqual({ removed: true });
    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('[mcp_servers]');
    expect(written).not.toContain('agent-term');
    expect(written).not.toContain('[[hooks]]');
  });

  it('preserves unrelated hooks when removing agent-term', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      if (String(path).endsWith('config.toml')) {
        return '[[hooks]]\nevent = "Stop"\ncommand = "notify-send done"\n\n# agent-term hook\n[[hooks]]\nevent = "SessionStart"\ncommand = "agent-term hook --agent codex-cli"\n';
      }
      return '---\n';
    });
    const adapter = new CodexCliAdapter();

    adapter.removeLegacyHooks();

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('event = "Stop"');
    expect(written).toContain('notify-send done');
    expect(written).not.toContain('agent-term');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- tests/codex-cli.test.ts
```

Expected: install/uninstall/removeLegacyHooks tests FAIL with `Error: not implemented`.

- [ ] **Step 3: Implement all three methods**

Replace the entire contents of `src/adapters/codex-cli.ts` with:

```ts
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { AgentAdapter } from './adapter.js';

const CODEX_DIR = process.env.CODEX_HOME ?? join(homedir(), '.codex');
const CONFIG_PATH = join(CODEX_DIR, 'config.toml');
const SKILL_DIR = join(CODEX_DIR, 'skills', 'agent-term');
const HOOK_MARKER = '# agent-term hook';

function readBundledSkill(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '..', 'assets', 'SKILL.md'), 'utf-8');
}

export class CodexCliAdapter implements AgentAdapter {
  name = 'codex-cli';
  displayName = 'Codex CLI';
  skillPath = SKILL_DIR;
  configPath = CONFIG_PATH;

  detect(): boolean {
    return existsSync(CODEX_DIR);
  }

  installSkill(): void {
    mkdirSync(this.skillPath, { recursive: true });
    writeFileSync(join(this.skillPath, 'SKILL.md'), readBundledSkill(), 'utf-8');
  }

  uninstallSkill(): void {
    rmSync(this.skillPath, { recursive: true, force: true });
  }

  removeLegacyHooks(): { removed: boolean } {
    if (!existsSync(this.configPath)) return { removed: false };

    let content: string;
    try {
      content = readFileSync(this.configPath, 'utf-8');
    } catch {
      return { removed: false };
    }

    if (!content.includes('agent-term')) return { removed: false };

    const lines = content.split('\n');
    const filtered: string[] = [];
    let skipping = false;

    for (const line of lines) {
      if (line.trim() === HOOK_MARKER) {
        skipping = true;
        continue;
      }
      if (skipping) {
        if (
          line.startsWith('[[hooks]]') ||
          line.startsWith('event ') || line.startsWith('event=') ||
          line.startsWith('command ') || line.startsWith('command=')
        ) continue;
        if (line.trim() === '') { skipping = false; continue; }
        skipping = false;
      }
      filtered.push(line);
    }

    writeFileSync(this.configPath, filtered.join('\n'), 'utf-8');
    return { removed: true };
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test -- tests/codex-cli.test.ts
```

Expected: all CodexCliAdapter tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/codex-cli.ts tests/codex-cli.test.ts
git commit -m "feat(codex-cli): implement installSkill, uninstallSkill, removeLegacyHooks"
```

---

### Task 9: Implement GeminiCliAdapter (all three methods, TDD)

Gemini stores config as JSON (`~/.gemini/settings.json`) like Claude Code, but with different hook event names (`BeforeTool`, `SessionStart`).

**Files:**
- Modify: `tests/gemini-cli.test.ts`
- Modify: `src/adapters/gemini-cli.ts`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `tests/gemini-cli.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { GeminiCliAdapter } from '../src/adapters/gemini-cli.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn((path: string, enc: string) => {
      if (String(path).endsWith('src/assets/SKILL.md')) {
        return '---\nname: agent-term\ndescription: test\n---\nBody';
      }
      return actual.readFileSync(path as any, enc as any);
    }),
  };
});

describe('GeminiCliAdapter metadata', () => {
  const adapter = new GeminiCliAdapter();

  it('has correct name and displayName', () => {
    expect(adapter.name).toBe('gemini-cli');
    expect(adapter.displayName).toBe('Gemini CLI');
  });

  it('resolves skillPath under ~/.gemini/skills/agent-term', () => {
    expect(adapter.skillPath).toBe(join(homedir(), '.gemini', 'skills', 'agent-term'));
  });

  it('resolves configPath to ~/.gemini/settings.json', () => {
    expect(adapter.configPath).toBe(join(homedir(), '.gemini', 'settings.json'));
  });
});

describe('GeminiCliAdapter.installSkill', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates the skill directory and writes SKILL.md', () => {
    const adapter = new GeminiCliAdapter();
    adapter.installSkill();

    expect(mkdirSync).toHaveBeenCalledWith(adapter.skillPath, { recursive: true });
    expect(writeFileSync).toHaveBeenCalledOnce();
    const [target, body] = vi.mocked(writeFileSync).mock.calls[0];
    expect(String(target)).toBe(join(adapter.skillPath, 'SKILL.md'));
    expect(String(body)).toContain('name: agent-term');
  });

  it('is idempotent', () => {
    const adapter = new GeminiCliAdapter();
    adapter.installSkill();
    adapter.installSkill();
    expect(writeFileSync).toHaveBeenCalledTimes(2);
  });
});

describe('GeminiCliAdapter.uninstallSkill', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('removes the skill directory recursively', () => {
    const adapter = new GeminiCliAdapter();
    adapter.uninstallSkill();
    expect(rmSync).toHaveBeenCalledWith(adapter.skillPath, { recursive: true, force: true });
  });
});

describe('GeminiCliAdapter.removeLegacyHooks', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns { removed: false } when settings.json does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const adapter = new GeminiCliAdapter();
    expect(adapter.removeLegacyHooks()).toEqual({ removed: false });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('returns { removed: false } when no agent-term hooks are present', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      if (String(path).endsWith('settings.json')) {
        return JSON.stringify({ mcpServers: { x: {} } });
      }
      return '---\n';
    });
    const adapter = new GeminiCliAdapter();
    expect(adapter.removeLegacyHooks()).toEqual({ removed: false });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('strips agent-term entries (by name) from BeforeTool and SessionStart', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      if (String(path).endsWith('settings.json')) {
        return JSON.stringify({
          hooks: {
            SessionStart: [
              { hooks: [{ name: 'agent-term', type: 'command', command: 'agent-term hook --agent gemini-cli' }] },
            ],
            BeforeTool: [
              { matcher: 'run_shell_command', hooks: [{ name: 'agent-term', type: 'command', command: 'agent-term hook --agent gemini-cli' }] },
              { matcher: 'write_file', hooks: [{ type: 'command', command: 'lint.sh' }] },
            ],
          },
        });
      }
      return '---\n';
    });
    const adapter = new GeminiCliAdapter();

    const result = adapter.removeLegacyHooks();

    expect(result).toEqual({ removed: true });
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.hooks.BeforeTool).toHaveLength(1);
    expect(written.hooks.BeforeTool[0].matcher).toBe('write_file');
    expect(written.hooks.SessionStart).toHaveLength(0);
  });

  it('falls back to matching by command substring when name is absent', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      if (String(path).endsWith('settings.json')) {
        return JSON.stringify({
          hooks: {
            BeforeTool: [
              { matcher: 'run_shell_command', hooks: [{ type: 'command', command: 'agent-term hook --agent gemini-cli' }] },
            ],
          },
        });
      }
      return '---\n';
    });
    const adapter = new GeminiCliAdapter();

    const result = adapter.removeLegacyHooks();

    expect(result).toEqual({ removed: true });
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.hooks.BeforeTool).toHaveLength(0);
  });

  it('preserves unrelated settings keys', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      if (String(path).endsWith('settings.json')) {
        return JSON.stringify({
          mcpServers: { x: {} },
          hooks: {
            SessionStart: [{ hooks: [{ name: 'agent-term', command: 'agent-term hook --agent gemini-cli' }] }],
          },
        });
      }
      return '---\n';
    });
    const adapter = new GeminiCliAdapter();

    adapter.removeLegacyHooks();

    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.mcpServers).toEqual({ x: {} });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- tests/gemini-cli.test.ts
```

Expected: install/uninstall/removeLegacyHooks tests FAIL with `Error: not implemented`.

- [ ] **Step 3: Implement all three methods**

Replace the entire contents of `src/adapters/gemini-cli.ts` with:

```ts
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { AgentAdapter } from './adapter.js';

const GEMINI_DIR = join(homedir(), '.gemini');
const SETTINGS_PATH = join(GEMINI_DIR, 'settings.json');
const SKILL_DIR = join(GEMINI_DIR, 'skills', 'agent-term');

function readBundledSkill(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '..', 'assets', 'SKILL.md'), 'utf-8');
}

export class GeminiCliAdapter implements AgentAdapter {
  name = 'gemini-cli';
  displayName = 'Gemini CLI';
  skillPath = SKILL_DIR;
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(GEMINI_DIR);
  }

  installSkill(): void {
    mkdirSync(this.skillPath, { recursive: true });
    writeFileSync(join(this.skillPath, 'SKILL.md'), readBundledSkill(), 'utf-8');
  }

  uninstallSkill(): void {
    rmSync(this.skillPath, { recursive: true, force: true });
  }

  removeLegacyHooks(): { removed: boolean } {
    if (!existsSync(this.configPath)) return { removed: false };

    let settings: any;
    try {
      settings = JSON.parse(readFileSync(this.configPath, 'utf-8'));
    } catch {
      return { removed: false };
    }

    if (!settings?.hooks) return { removed: false };

    const isAgentTermEntry = (entry: any): boolean =>
      Array.isArray(entry?.hooks) &&
      entry.hooks.some((h: any) =>
        h?.name === 'agent-term' ||
        (typeof h?.command === 'string' && h.command.includes('agent-term')),
      );

    let changed = false;
    for (const key of ['BeforeTool', 'SessionStart']) {
      if (!Array.isArray(settings.hooks[key])) continue;
      const before = settings.hooks[key].length;
      settings.hooks[key] = settings.hooks[key].filter((entry: any) => !isAgentTermEntry(entry));
      if (settings.hooks[key].length !== before) changed = true;
    }

    if (!changed) return { removed: false };

    writeFileSync(this.configPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
    return { removed: true };
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test -- tests/gemini-cli.test.ts
```

Expected: all GeminiCliAdapter tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/gemini-cli.ts tests/gemini-cli.test.ts
git commit -m "feat(gemini-cli): implement installSkill, uninstallSkill, removeLegacyHooks"
```

---

### Task 10: Full test sweep + CLI smoke test

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term
pnpm test
```

Expected: all tests pass. Total count should be **lower than the previous 89** because hook tests were removed; new adapter tests bring it back up. Exact number is fine as long as everything is green.

- [ ] **Step 2: Build and inspect CLI output**

```bash
pnpm build
node dist/cli.js --help
```

Expected: help text lists `init`, `start`, `logs`, `send`, `kill`, `restart`, `status`, `list`. No `hook` subcommand.

- [ ] **Step 3: Smoke-test init in non-interactive mode with CODEX_HOME override**

We don't want the test to pollute the user's real `~/.claude` or `~/.codex`. Point it at a temp directory:

```bash
TMPROOT=$(mktemp -d)
mkdir -p "$TMPROOT/.claude" "$TMPROOT/.codex" "$TMPROOT/.gemini"
HOME="$TMPROOT" CODEX_HOME="$TMPROOT/.codex" node dist/cli.js init --non-interactive --agents claude-code,codex-cli,gemini-cli
ls "$TMPROOT/.claude/skills/agent-term/SKILL.md" "$TMPROOT/.codex/skills/agent-term/SKILL.md" "$TMPROOT/.gemini/skills/agent-term/SKILL.md"
rm -rf "$TMPROOT"
```

Expected: all three SKILL.md files exist. No errors.

- [ ] **Step 4: Commit (no changes expected — this task is verification only)**

If any fix-up commits were required during smoke testing, commit them here with a descriptive message. Otherwise skip.

---

### Task 11: Rewrite README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current README to see what needs updating**

```bash
cat /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term/README.md
```

- [ ] **Step 2: Rewrite the "How it works" section and remove hook references**

Target edits:

- Replace any mention of `agent-term hook`, PreToolUse/BeforeTool/SessionStart hooks, or "shell interception" with the skill-based model.
- Add a new section titled **"Agent integration"** with three subsections (Claude Code, Codex CLI, Gemini CLI) that each state: "`agent-term init` installs the skill at `<path>`. The skill auto-activates when you ask the agent to start a persistent process."
- Add a **"Migrating from 0.x"** section: "Run `agent-term init`. It will detect any existing agent-term hook entries in your agent config files and remove them automatically, then install the skill."
- Keep all command documentation for `start`, `logs`, `send`, `kill`, `restart`, `status`, `list` unchanged.
- Remove any documentation of `agent-term hook` (it no longer exists).

Use the spec at `docs/superpowers/specs/2026-04-16-skill-based-integration-design.md` as the source of truth for wording.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for skill-based integration"
```

---

### Task 12: Update docs/ — mark superseded specs

**Files:**
- Modify: `docs/superpowers/specs/2026-03-23-agent-term-design.md`
- Modify: `docs/superpowers/specs/2026-03-24-universal-tmux-hook-design.md`
- Modify: `docs/superpowers/specs/2026-03-24-session-context-injection-design.md`

- [ ] **Step 1: Add a "Superseded by" banner to each old spec**

At the top of each file (below the H1 title), insert:

```markdown
> **Superseded by:** [2026-04-16-skill-based-integration-design.md](./2026-04-16-skill-based-integration-design.md) (v1.0.0). This document describes the original hook-based integration. Kept for historical context.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/
git commit -m "docs(specs): mark pre-1.0 hook-era designs as superseded"
```

---

### Task 13: Bump version to 1.0.0 and generate CHANGELOG entry

`standard-version` is already wired up. Use it so the CHANGELOG entry matches the existing format.

**Files:**
- Modify: `package.json` (version)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run standard-version with an explicit major bump**

```bash
cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term
pnpm release:major
```

This bumps `package.json` to `1.0.0`, regenerates `CHANGELOG.md` from conventional-commit messages, and creates a release commit + git tag `v1.0.0`.

- [ ] **Step 2: Verify**

```bash
cat package.json | grep '"version"'
head -30 CHANGELOG.md
git log --oneline -5
git tag | tail -3
```

Expected:
- `package.json` shows `"version": "1.0.0"`.
- `CHANGELOG.md` top entry is `## [1.0.0]` with bullets sourced from the `feat!:` / `refactor!:` / `docs:` commits from Tasks 1–12.
- A `v1.0.0` tag exists.

- [ ] **Step 3: Add a breaking-change migration note to CHANGELOG.md**

`standard-version` pulls the `BREAKING CHANGE:` footer from Task 4's commit, but we want a prominent user-facing migration note. Open `CHANGELOG.md`, locate the `## [1.0.0]` heading, and **directly below it** insert:

```markdown
### Breaking changes & migration

- The `agent-term hook` subcommand is removed. agent-term now integrates with each supported agent via a bundled `SKILL.md` installed into the agent's skills directory.
- **Upgrade path:** run `agent-term init`. It detects and removes any pre-1.0 hook entries from your agent config files, then installs the skill.
- Affected agents: Claude Code (`~/.claude/skills/agent-term/SKILL.md`), Codex CLI (`$CODEX_HOME/skills/agent-term/SKILL.md` or `~/.codex/skills/agent-term/SKILL.md`), Gemini CLI (`~/.gemini/skills/agent-term/SKILL.md`).
```

- [ ] **Step 4: Amend the release commit to include the migration note**

Because `standard-version` already created the release commit, stage the CHANGELOG edit and amend:

```bash
git add CHANGELOG.md
git commit --amend --no-edit
```

Then move the tag to the amended commit:

```bash
git tag -f v1.0.0
```

- [ ] **Step 5: Full verification**

```bash
pnpm build
pnpm test
node dist/cli.js --version
```

Expected: build succeeds, all tests pass, `--version` prints `0.1.0` (NOTE: the current `cli.ts` hardcodes `.version('0.1.0')` — fix this as part of this step).

Edit `src/cli.ts` to read the version from `package.json`:

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
```

Then change `.version('0.1.0')` to `.version(pkg.version)`.

Rebuild and verify:

```bash
pnpm build
node dist/cli.js --version
```

Expected: prints `1.0.0`.

- [ ] **Step 6: Commit the version-reading fix and move the tag again**

```bash
git add src/cli.ts
git commit -m "fix(cli): read version from package.json"
git tag -f v1.0.0
```

(The tag now points at the final commit that actually reports 1.0.0 via `--version`.)

---

## Self-Review

**Spec coverage check:**

- ✅ Bundled SKILL.md asset with required frontmatter and body → Tasks 1, 3
- ✅ Build-time asset copy step → Task 2
- ✅ Collapsed AgentAdapter interface → Task 4
- ✅ `installSkill()` / `uninstallSkill()` / `removeLegacyHooks()` per adapter → Tasks 5–9
- ✅ `hook` subcommand removed → Task 4
- ✅ `hook.ts`, `context.ts` and their tests deleted → Task 4
- ✅ `init` flow with legacy-hook migration → Task 4 (init stub), end-to-end verified in Task 10
- ✅ README rewrite → Task 11
- ✅ Superseded-spec banners → Task 12
- ✅ Version bump to 1.0.0 + CHANGELOG → Task 13
- ✅ All acceptance criteria in the spec map to test or smoke-test steps above.

**Placeholder scan:** none — every code step shows complete code.

**Type consistency:**
- `AgentAdapter` fields `skillPath`, `configPath`, `name`, `displayName` — consistent across Tasks 4, 5, 6, 7, 8, 9 and referenced identically in `init.ts` (Task 4) and tests.
- `removeLegacyHooks()` returns `{ removed: boolean }` everywhere.
- `readBundledSkill()` helper duplicated across three adapters — a DRY refactor would move it to a shared module, but the spec's scope keeps each adapter self-contained; revisit only if a fourth adapter is added.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-skill-based-integration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
