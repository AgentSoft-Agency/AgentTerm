# agent-term Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an npm package that centralizes long-running terminal processes in tmux sessions, accessible from any AI agent session via CLI and agent-specific hook adapters.

**Architecture:** A TypeScript CLI (`agent-term`) with subcommands for managing tmux sessions. An adapter system translates between agent-specific hook formats and a common internal format. Interactive init auto-detects installed agents and registers hooks. Config file with glob patterns determines which commands get intercepted.

**Tech Stack:** TypeScript, Node.js, pnpm, commander (CLI), @clack/prompts (interactive UI), child_process.spawn (tmux)

**Spec:** `docs/superpowers/specs/2026-03-23-agent-term-design.md`

---

## File Structure

```
agent-term/
├── package.json              # npm package config with bin field
├── tsconfig.json             # TypeScript config
├── vitest.config.ts          # Test config
├── src/
│   ├── cli.ts                # Entry point, subcommand routing via commander
│   ├── commands/
│   │   ├── init.ts           # Interactive setup (tmux check, config, agent detection)
│   │   ├── hook.ts           # Hook entry point (--agent dispatches to adapter)
│   │   ├── start.ts          # Start a shared terminal in tmux
│   │   ├── list.ts           # List active terminals
│   │   ├── logs.ts           # Read tmux scrollback
│   │   ├── send.ts           # Send input to tmux session
│   │   ├── kill.ts           # Kill a terminal
│   │   └── status.ts         # Show terminal status
│   ├── adapters/
│   │   ├── adapter.ts        # AgentAdapter interface + HookInput/HookResult types
│   │   ├── claude-code.ts    # Claude Code adapter (fully implemented)
│   │   ├── gemini-cli.ts     # Gemini CLI adapter (stub)
│   │   ├── codex-cli.ts      # Codex CLI adapter (stub)
│   │   └── registry.ts       # Adapter lookup by name, detection scan
│   ├── tmux.ts               # tmux wrapper (spawn tmux commands via child_process)
│   ├── config.ts             # Load/parse ~/.agent-term/config patterns
│   └── naming.ts             # Auto-name generation from commands
├── tests/
│   ├── naming.test.ts        # Naming logic tests
│   ├── config.test.ts        # Config parsing tests
│   ├── tmux.test.ts          # tmux wrapper tests (mocked)
│   ├── hook.test.ts          # Hook command integration tests
│   ├── claude-code.test.ts   # Claude Code adapter tests
│   └── registry.test.ts      # Adapter registry tests
└── README.md
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/cli.ts`

- [ ] **Step 1: Initialize the project**

```bash
cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term
git init
pnpm init
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm add commander @clack/prompts
pnpm add -D typescript vitest @types/node
```

- [ ] **Step 3: Create tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 5: Update package.json**

Set the following fields in `package.json`:

```json
{
  "name": "agent-term",
  "version": "0.1.0",
  "description": "Shared long-running terminals for AI coding agents",
  "type": "module",
  "main": "dist/cli.js",
  "bin": {
    "agent-term": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "files": ["dist"],
  "license": "MIT"
}
```

- [ ] **Step 6: Create CLI entry point stub**

Create `src/cli.ts`:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('agent-term')
  .description('Shared long-running terminals for AI coding agents')
  .version('0.1.0');

program.parse();
```

- [ ] **Step 7: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
*.tgz
```

- [ ] **Step 8: Verify build**

Run: `pnpm build`
Expected: Compiles with no errors. `dist/cli.js` exists.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: scaffold agent-term project"
```

---

## Task 2: Naming Module

**Files:**
- Create: `src/naming.ts`
- Create: `tests/naming.test.ts`

- [ ] **Step 1: Write the naming tests**

Create `tests/naming.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { autoName } from '../src/naming.js';

describe('autoName', () => {
  it('converts simple commands to kebab-case', () => {
    expect(autoName('pnpm dev')).toBe('pnpm-dev');
  });

  it('handles multi-word commands', () => {
    expect(autoName('docker compose up')).toBe('docker-compose-up');
  });

  it('strips flags', () => {
    expect(autoName('pnpm dev --port 3000')).toBe('pnpm-dev');
  });

  it('handles paths in commands', () => {
    expect(autoName('node ./server.js')).toBe('node-server.js');
  });

  it('limits length', () => {
    const long = 'some very long command with many words that goes on forever';
    expect(autoName(long).length).toBeLessThanOrEqual(30);
  });

  it('handles npm run scripts', () => {
    expect(autoName('npm run dev')).toBe('npm-run-dev');
  });

  it('strips leading path components', () => {
    expect(autoName('/usr/bin/node server.js')).toBe('node-server.js');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/naming.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement naming module**

Create `src/naming.ts`:

```typescript
const SESSION_PREFIX = 'at-';
const MAX_NAME_LENGTH = 30;

/**
 * Generate a terminal name from a command string.
 * "pnpm dev" → "pnpm-dev"
 * "docker compose up --detach" → "docker-compose-up"
 */
export function autoName(command: string): string {
  const parts = command.trim().split(/\s+/);

  // Take words until we hit a flag (starts with -)
  const words: string[] = [];
  for (const part of parts) {
    if (part.startsWith('-')) break;
    // Strip leading path: /usr/bin/node → node, ./server.js → server.js
    const basename = part.replace(/^.*\//, '');
    if (basename) words.push(basename);
  }

  if (words.length === 0) return 'unknown';

  const name = words.join('-').toLowerCase();
  return name.slice(0, MAX_NAME_LENGTH);
}

/**
 * Resolve a name with collision suffix.
 * Given existing names ["pnpm-dev", "pnpm-dev-2"], returns "pnpm-dev-3".
 */
export function resolveCollision(baseName: string, existingNames: string[]): string {
  if (!existingNames.includes(baseName)) return baseName;

  let n = 2;
  while (existingNames.includes(`${baseName}-${n}`)) n++;
  return `${baseName}-${n}`;
}

/**
 * Convert a user-facing name to the tmux session name.
 * "pnpm-dev" → "at-pnpm-dev"
 */
export function toSessionName(name: string): string {
  return `${SESSION_PREFIX}${name}`;
}

/**
 * Convert a tmux session name back to user-facing name.
 * "at-pnpm-dev" → "pnpm-dev"
 */
export function fromSessionName(sessionName: string): string {
  return sessionName.startsWith(SESSION_PREFIX)
    ? sessionName.slice(SESSION_PREFIX.length)
    : sessionName;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/naming.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/naming.ts tests/naming.test.ts
git commit -m "feat: add naming module for auto-name generation"
```

---

## Task 3: Config Module

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write config tests**

Create `tests/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parsePatterns, matchCommand } from '../src/config.js';

describe('parsePatterns', () => {
  it('parses lines into patterns', () => {
    const input = 'pnpm dev*\nnpm run dev*';
    expect(parsePatterns(input)).toEqual(['pnpm dev*', 'npm run dev*']);
  });

  it('ignores comments and blank lines', () => {
    const input = '# comment\n\npnpm dev*\n  \n# another\nnpm start*';
    expect(parsePatterns(input)).toEqual(['pnpm dev*', 'npm start*']);
  });

  it('trims whitespace', () => {
    const input = '  pnpm dev*  \n  npm start*  ';
    expect(parsePatterns(input)).toEqual(['pnpm dev*', 'npm start*']);
  });
});

describe('matchCommand', () => {
  const patterns = ['pnpm dev*', 'docker compose up*', 'npm run watch*'];

  it('matches exact command', () => {
    expect(matchCommand('pnpm dev', patterns)).toBe(true);
  });

  it('matches command with trailing args via wildcard', () => {
    expect(matchCommand('pnpm dev --port 3000', patterns)).toBe(true);
  });

  it('does not match unrelated commands', () => {
    expect(matchCommand('git status', patterns)).toBe(false);
  });

  it('matches docker compose', () => {
    expect(matchCommand('docker compose up -d', patterns)).toBe(true);
  });

  it('does not match partial prefix without wildcard', () => {
    expect(matchCommand('pnpm deploy', ['pnpm dev'])).toBe(false);
  });

  it('matches with wildcard at end', () => {
    expect(matchCommand('pnpm dev', ['pnpm dev*'])).toBe(true);
    expect(matchCommand('pnpm develop', ['pnpm dev*'])).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement config module**

Create `src/config.ts`:

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.agent-term');
const CONFIG_FILE = join(CONFIG_DIR, 'config');

export const DEFAULT_CONFIG = `# Long-running dev servers
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
`;

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * Parse a config file string into an array of patterns.
 * Strips comments (#) and blank lines.
 */
export function parsePatterns(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Load patterns from the config file.
 * Returns empty array if config doesn't exist.
 */
export function loadPatterns(): string[] {
  if (!existsSync(CONFIG_FILE)) return [];
  const content = readFileSync(CONFIG_FILE, 'utf-8');
  return parsePatterns(content);
}

/**
 * Check if a command matches any pattern.
 * Patterns support trailing * as a glob wildcard.
 */
export function matchCommand(command: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (command.startsWith(prefix)) return true;
    } else {
      if (command === pattern) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/config.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: add config module for pattern matching"
```

---

## Task 4: Tmux Wrapper

**Files:**
- Create: `src/tmux.ts`
- Create: `tests/tmux.test.ts`

- [ ] **Step 1: Write tmux wrapper tests**

Create `tests/tmux.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTmuxArgs, parseTmuxList } from '../src/tmux.js';

describe('buildTmuxArgs', () => {
  it('uses the agent-term server', () => {
    const args = buildTmuxArgs(['list-sessions']);
    expect(args).toEqual(['-L', 'agent-term', 'list-sessions']);
  });

  it('passes through additional args', () => {
    const args = buildTmuxArgs(['new-session', '-d', '-s', 'at-test']);
    expect(args).toEqual(['-L', 'agent-term', 'new-session', '-d', '-s', 'at-test']);
  });
});

describe('parseTmuxList', () => {
  it('parses -F #{session_name} output (one name per line)', () => {
    const output = 'at-pnpm-dev\nat-docker-up';
    const sessions = parseTmuxList(output);
    expect(sessions).toEqual(['at-pnpm-dev', 'at-docker-up']);
  });

  it('returns empty array for empty output', () => {
    expect(parseTmuxList('')).toEqual([]);
  });

  it('handles "no server running" error gracefully', () => {
    expect(parseTmuxList('no server running on /tmp/tmux-501/agent-term')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/tmux.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement tmux wrapper**

Create `src/tmux.ts`:

```typescript
import { spawnSync, spawn, type ChildProcess } from 'node:child_process';

const TMUX_SERVER = 'agent-term';

/**
 * Build tmux args with the dedicated server flag.
 */
export function buildTmuxArgs(args: string[]): string[] {
  return ['-L', TMUX_SERVER, ...args];
}

/**
 * Run a tmux command synchronously and return stdout.
 */
export function tmuxSync(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('tmux', buildTmuxArgs(args), {
    encoding: 'utf-8',
    timeout: 10000,
  });
  return {
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Check if tmux is installed.
 */
export function isTmuxInstalled(): boolean {
  const result = spawnSync('tmux', ['-V'], { encoding: 'utf-8' });
  return result.status === 0;
}

/**
 * List all session names on the agent-term tmux server.
 */
export function listSessionNames(): string[] {
  const { stdout, exitCode } = tmuxSync(['list-sessions', '-F', '#{session_name}']);
  if (exitCode !== 0 || !stdout) return [];
  return parseTmuxList(stdout);
}

/**
 * Parse tmux list-sessions output into session names.
 */
export function parseTmuxList(output: string): string[] {
  if (!output || output.includes('no server running')) return [];
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((name) => name.length > 0);
}

/**
 * Check if a specific session exists and is running.
 */
export function sessionExists(sessionName: string): boolean {
  const { exitCode } = tmuxSync(['has-session', '-t', sessionName]);
  return exitCode === 0;
}

/**
 * Create a new tmux session running a command.
 */
export function createSession(sessionName: string, command: string): void {
  tmuxSync(['new-session', '-d', '-s', sessionName, '-x', '200', '-y', '50', command]);
}

/**
 * Capture scrollback from a tmux session.
 */
export function capturePane(sessionName: string, lines: number): string {
  const { stdout } = tmuxSync([
    'capture-pane', '-t', sessionName, '-p', '-S', `-${lines}`,
  ]);
  return stdout;
}

/**
 * Send keys to a tmux session.
 */
export function sendKeys(sessionName: string, keys: string): void {
  tmuxSync(['send-keys', '-t', sessionName, keys]);
}

/**
 * Kill a tmux session.
 */
export function killSession(sessionName: string): void {
  tmuxSync(['kill-session', '-t', sessionName]);
}

/**
 * Check if the process in a tmux session is still running.
 * Returns the pane_pid and pane_dead status.
 */
export function getSessionStatus(sessionName: string): { pid: string; dead: boolean; exitCode: string } {
  const { stdout } = tmuxSync([
    'display-message', '-t', sessionName, '-p', '#{pane_pid}:#{pane_dead}:#{pane_dead_status}',
  ]);
  const [pid = '', deadStr = '', exitCode = ''] = stdout.split(':');
  return { pid, dead: deadStr === '1', exitCode };
}

/**
 * Get the command running in a tmux session.
 */
export function getSessionCommand(sessionName: string): string {
  const { stdout } = tmuxSync([
    'display-message', '-t', sessionName, '-p', '#{pane_start_command}',
  ]);
  return stdout;
}

/**
 * Get the session creation time as an epoch timestamp.
 */
export function getSessionCreated(sessionName: string): number {
  const { stdout } = tmuxSync([
    'display-message', '-t', sessionName, '-p', '#{session_created}',
  ]);
  return parseInt(stdout, 10) || 0;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/tmux.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/tmux.ts tests/tmux.test.ts
git commit -m "feat: add tmux wrapper module"
```

---

## Task 5: Adapter System

**Files:**
- Create: `src/adapters/adapter.ts`
- Create: `src/adapters/claude-code.ts`
- Create: `src/adapters/gemini-cli.ts`
- Create: `src/adapters/codex-cli.ts`
- Create: `src/adapters/registry.ts`
- Create: `tests/claude-code.test.ts`
- Create: `tests/registry.test.ts`

- [ ] **Step 1: Write Claude Code adapter tests**

Create `tests/claude-code.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.js';

describe('ClaudeCodeAdapter', () => {
  const adapter = new ClaudeCodeAdapter();

  describe('parseHookInput', () => {
    it('extracts command and sessionId from Claude Code stdin', () => {
      const stdin = JSON.stringify({
        session_id: 'abc123',
        tool_input: { command: 'pnpm dev' },
        tool_name: 'Bash',
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: 'pnpm dev', sessionId: 'abc123' });
    });

    it('handles missing session_id', () => {
      const stdin = JSON.stringify({
        tool_input: { command: 'git status' },
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: 'git status', sessionId: undefined });
    });
  });

  describe('formatHookOutput', () => {
    it('returns empty string for passthrough', () => {
      const result = adapter.formatHookOutput({ action: 'passthrough' });
      expect(result).toBe('');
    });

    it('formats rewrite with updatedInput', () => {
      const result = adapter.formatHookOutput({
        action: 'rewrite',
        rewrittenCommand: 'agent-term start --name pnpm-dev -- pnpm dev',
        systemMessage: "Command routed to shared terminal 'pnpm-dev' via agent-term.",
      });
      const parsed = JSON.parse(result);
      expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow');
      expect(parsed.hookSpecificOutput.updatedInput.command).toBe(
        'agent-term start --name pnpm-dev -- pnpm dev',
      );
      expect(parsed.systemMessage).toContain('pnpm-dev');
    });
  });
});
```

- [ ] **Step 2: Write registry tests**

Create `tests/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getAdapter, getAllAdapters } from '../src/adapters/registry.js';

describe('registry', () => {
  it('returns claude-code adapter by name', () => {
    const adapter = getAdapter('claude-code');
    expect(adapter).toBeDefined();
    expect(adapter!.name).toBe('claude-code');
  });

  it('returns undefined for unknown adapter', () => {
    expect(getAdapter('unknown-agent')).toBeUndefined();
  });

  it('lists all adapters', () => {
    const all = getAllAdapters();
    expect(all.length).toBe(3);
    const names = all.map((a) => a.name);
    expect(names).toContain('claude-code');
    expect(names).toContain('gemini-cli');
    expect(names).toContain('codex-cli');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- tests/claude-code.test.ts tests/registry.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Create the adapter interface**

Create `src/adapters/adapter.ts`:

```typescript
export interface HookInput {
  command: string;
  sessionId?: string;
}

export interface HookResult {
  action: 'passthrough' | 'rewrite';
  rewrittenCommand?: string;
  systemMessage?: string;
}

export interface AgentAdapter {
  name: string;
  displayName: string;
  configPath: string;
  detect(): boolean;
  register(): void;
  unregister(): void;
  parseHookInput(stdin: string): HookInput;
  formatHookOutput(result: HookResult): string;
}
```

- [ ] **Step 5: Implement Claude Code adapter**

Create `src/adapters/claude-code.ts`:

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter, HookInput, HookResult } from './adapter.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');

export class ClaudeCodeAdapter implements AgentAdapter {
  name = 'claude-code';
  displayName = 'Claude Code';
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(CLAUDE_DIR);
  }

  register(): void {
    const settings = this.readSettings();
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];

    const existing = settings.hooks.PreToolUse as any[];
    const alreadyRegistered = existing.some((entry: any) =>
      entry.hooks?.some((h: any) => typeof h.command === 'string' && h.command.includes('agent-term')),
    );

    if (!alreadyRegistered) {
      existing.push({
        matcher: 'Bash',
        hooks: [{
          type: 'command',
          command: 'agent-term hook --agent claude-code',
          timeout: 15,
        }],
      });
    }

    this.writeSettings(settings);
  }

  unregister(): void {
    const settings = this.readSettings();
    if (!settings.hooks?.PreToolUse) return;

    settings.hooks.PreToolUse = (settings.hooks.PreToolUse as any[]).filter(
      (entry: any) => !entry.hooks?.some((h: any) =>
        typeof h.command === 'string' && h.command.includes('agent-term'),
      ),
    );

    this.writeSettings(settings);
  }

  parseHookInput(stdin: string): HookInput {
    const data = JSON.parse(stdin);
    return {
      command: data.tool_input?.command ?? '',
      sessionId: data.session_id,
    };
  }

  formatHookOutput(result: HookResult): string {
    if (result.action === 'passthrough') return '';

    return JSON.stringify({
      hookSpecificOutput: {
        permissionDecision: 'allow',
        updatedInput: {
          command: result.rewrittenCommand,
        },
      },
      systemMessage: result.systemMessage ?? '',
    });
  }

  private readSettings(): any {
    if (!existsSync(SETTINGS_PATH)) return {};
    try {
      return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
    } catch {
      return {};
    }
  }

  private writeSettings(settings: any): void {
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  }
}
```

- [ ] **Step 6: Create Gemini CLI stub adapter**

Create `src/adapters/gemini-cli.ts`:

```typescript
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter, HookInput, HookResult } from './adapter.js';

const GEMINI_DIR = join(homedir(), '.gemini');
const SETTINGS_PATH = join(GEMINI_DIR, 'settings.json');

export class GeminiCliAdapter implements AgentAdapter {
  name = 'gemini-cli';
  displayName = 'Gemini CLI';
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(GEMINI_DIR);
  }

  register(): void {
    console.warn('Gemini CLI hook registration is not yet implemented. Hook format TBD.');
  }

  unregister(): void {
    console.warn('Gemini CLI hook unregistration is not yet implemented.');
  }

  parseHookInput(stdin: string): HookInput {
    console.warn('Gemini CLI hook parsing is not yet implemented. Passing through.');
    return { command: '' };
  }

  formatHookOutput(result: HookResult): string {
    return '';
  }
}
```

- [ ] **Step 7: Create Codex CLI stub adapter**

Create `src/adapters/codex-cli.ts`:

```typescript
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter, HookInput, HookResult } from './adapter.js';

const CODEX_DIR = join(homedir(), '.codex');
const CONFIG_PATH = join(CODEX_DIR, 'config.json');

export class CodexCliAdapter implements AgentAdapter {
  name = 'codex-cli';
  displayName = 'Codex CLI';
  configPath = CONFIG_PATH;

  detect(): boolean {
    return existsSync(CODEX_DIR);
  }

  register(): void {
    console.warn('Codex CLI hook registration is not yet implemented. Hook format TBD.');
  }

  unregister(): void {
    console.warn('Codex CLI hook unregistration is not yet implemented.');
  }

  parseHookInput(stdin: string): HookInput {
    console.warn('Codex CLI hook parsing is not yet implemented. Passing through.');
    return { command: '' };
  }

  formatHookOutput(result: HookResult): string {
    return '';
  }
}
```

- [ ] **Step 8: Create the adapter registry**

Create `src/adapters/registry.ts`:

```typescript
import type { AgentAdapter } from './adapter.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import { GeminiCliAdapter } from './gemini-cli.js';
import { CodexCliAdapter } from './codex-cli.js';

const adapters: AgentAdapter[] = [
  new ClaudeCodeAdapter(),
  new GeminiCliAdapter(),
  new CodexCliAdapter(),
];

export function getAdapter(name: string): AgentAdapter | undefined {
  return adapters.find((a) => a.name === name);
}

export function getAllAdapters(): AgentAdapter[] {
  return adapters;
}

export function detectInstalledAgents(): AgentAdapter[] {
  return adapters.filter((a) => a.detect());
}
```

- [ ] **Step 9: Run tests**

Run: `pnpm test -- tests/claude-code.test.ts tests/registry.test.ts`
Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/adapters/ tests/claude-code.test.ts tests/registry.test.ts
git commit -m "feat: add agent adapter system with Claude Code, Gemini, Codex"
```

---

## Task 6: Hook Command

**Files:**
- Create: `src/commands/hook.ts`
- Create: `tests/hook.test.ts`

- [ ] **Step 1: Write hook tests**

Create `tests/hook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processHook } from '../src/commands/hook.js';
import type { HookResult } from '../src/adapters/adapter.js';

// Mock tmux
vi.mock('../src/tmux.js', () => ({
  sessionExists: vi.fn(() => false),
  listSessionNames: vi.fn(() => []),
}));

// Mock config
vi.mock('../src/config.js', () => ({
  loadPatterns: vi.fn(() => ['pnpm dev*', 'docker compose up*']),
}));

import { sessionExists } from '../src/tmux.js';

describe('processHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns passthrough for non-matching commands', () => {
    const result = processHook('git status');
    expect(result.action).toBe('passthrough');
  });

  it('returns rewrite with start for matching new command', () => {
    const result = processHook('pnpm dev');
    expect(result.action).toBe('rewrite');
    expect(result.rewrittenCommand).toContain('agent-term start');
    expect(result.rewrittenCommand).toContain('pnpm dev');
  });

  it('returns rewrite with logs for already-running terminal', () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    const result = processHook('pnpm dev');
    expect(result.action).toBe('rewrite');
    expect(result.rewrittenCommand).toContain('agent-term logs');
  });

  it('matches docker compose with trailing args', () => {
    const result = processHook('docker compose up -d');
    expect(result.action).toBe('rewrite');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/hook.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement hook command**

Create `src/commands/hook.ts`:

```typescript
import { getAdapter } from '../adapters/registry.js';
import { loadPatterns, matchCommand } from '../config.js';
import { autoName, toSessionName } from '../naming.js';
import { sessionExists } from '../tmux.js';
import type { HookResult } from '../adapters/adapter.js';

/**
 * Core hook logic: match command against patterns, decide action.
 * Separated from I/O for testability.
 */
export function processHook(command: string): HookResult {
  const patterns = loadPatterns();

  if (!matchCommand(command, patterns)) {
    return { action: 'passthrough' };
  }

  const baseName = autoName(command);
  const tmuxSessionName = toSessionName(baseName);

  if (sessionExists(tmuxSessionName)) {
    return {
      action: 'rewrite',
      rewrittenCommand: `agent-term logs ${baseName} --lines 50`,
      systemMessage: `Terminal '${baseName}' is already running. Showing recent logs.`,
    };
  }

  return {
    action: 'rewrite',
    rewrittenCommand: `agent-term start --name ${baseName} -- ${command}`,
    systemMessage: `Command routed to shared terminal '${baseName}' via agent-term.`,
  };
}

/**
 * Full hook entry point: reads stdin, dispatches to adapter, runs core logic,
 * formats output, writes to stdout.
 */
export async function runHook(agentName: string): Promise<void> {
  const adapter = getAdapter(agentName);
  if (!adapter) {
    process.stderr.write(`Warning: unknown agent '${agentName}', passing through.\n`);
    process.exit(0);
  }

  let stdin = '';
  for await (const chunk of process.stdin) {
    stdin += chunk;
  }

  let input;
  try {
    input = adapter.parseHookInput(stdin);
  } catch {
    // Can't parse → pass through
    process.exit(0);
  }

  if (!input.command) {
    process.exit(0);
  }

  const result = processHook(input.command);
  const output = adapter.formatHookOutput(result);

  if (output) {
    process.stdout.write(output);
  }

  process.exit(0);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/hook.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/hook.ts tests/hook.test.ts
git commit -m "feat: add hook command with pattern matching and adapter dispatch"
```

---

## Task 7: Terminal Management Commands (start, logs, send, kill, status, list)

**Files:**
- Create: `src/commands/start.ts`
- Create: `src/commands/logs.ts`
- Create: `src/commands/send.ts`
- Create: `src/commands/kill.ts`
- Create: `src/commands/status.ts`
- Create: `src/commands/list.ts`

- [ ] **Step 1: Implement start command**

Create `src/commands/start.ts`:

```typescript
import { createSession, sessionExists, capturePane, listSessionNames } from '../tmux.js';
import { autoName, resolveCollision, toSessionName, fromSessionName } from '../naming.js';

export function runStart(args: string[], name?: string): void {
  const command = args.join(' ');
  if (!command) {
    console.error('Error: no command specified. Usage: agent-term start -- <command>');
    process.exit(1);
  }

  const baseName = name ?? autoName(command);
  const sessionName = toSessionName(baseName);

  // Handle TOCTOU race: if session already exists, show logs
  if (sessionExists(sessionName)) {
    console.log(`Terminal '${baseName}' is already running. Showing recent output:\n`);
    console.log(capturePane(sessionName, 50));
    return;
  }

  // Handle name collision for explicit --name
  if (name) {
    const existing = listSessionNames().map(fromSessionName);
    const resolved = resolveCollision(baseName, existing);
    if (resolved !== baseName) {
      const resolvedSession = toSessionName(resolved);
      createSession(resolvedSession, command);
      return waitForOutput(resolved, resolvedSession);
    }
  }

  createSession(sessionName, command);
  waitForOutput(baseName, sessionName);
}

function waitForOutput(name: string, sessionName: string): void {
  const start = Date.now();
  const timeout = 3000;

  const check = () => {
    const output = capturePane(sessionName, 50).trim();
    if (output) {
      console.log(`Terminal '${name}' started:\n`);
      console.log(output);
      return;
    }
    if (Date.now() - start < timeout) {
      setTimeout(check, 200);
    } else {
      console.log(`Terminal '${name}' started, awaiting output...`);
    }
  };

  check();
}
```

- [ ] **Step 2: Implement logs command**

Create `src/commands/logs.ts`:

```typescript
import { capturePane, sessionExists } from '../tmux.js';
import { toSessionName } from '../naming.js';

export function runLogs(name: string, lines: number): void {
  const sessionName = toSessionName(name);

  if (!sessionExists(sessionName)) {
    console.error(`Error: terminal '${name}' not found. Run 'agent-term list' to see active terminals.`);
    process.exit(1);
  }

  const output = capturePane(sessionName, lines);
  console.log(output);
}
```

- [ ] **Step 3: Implement send command**

Create `src/commands/send.ts`:

```typescript
import { sendKeys, sessionExists } from '../tmux.js';
import { toSessionName } from '../naming.js';

export function runSend(name: string, input: string): void {
  const sessionName = toSessionName(name);

  if (!sessionExists(sessionName)) {
    console.error(`Error: terminal '${name}' not found.`);
    process.exit(1);
  }

  sendKeys(sessionName, input);
  console.log(`Sent to '${name}': ${input}`);
}
```

- [ ] **Step 4: Implement kill command**

Create `src/commands/kill.ts`:

```typescript
import { killSession, sessionExists } from '../tmux.js';
import { toSessionName } from '../naming.js';

export function runKill(name: string): void {
  const sessionName = toSessionName(name);

  if (!sessionExists(sessionName)) {
    console.error(`Error: terminal '${name}' not found.`);
    process.exit(1);
  }

  killSession(sessionName);
  console.log(`Terminal '${name}' killed.`);
}
```

- [ ] **Step 5: Implement status command**

Create `src/commands/status.ts`:

```typescript
import { sessionExists, getSessionStatus, capturePane } from '../tmux.js';
import { toSessionName } from '../naming.js';

export function runStatus(name: string): void {
  const sessionName = toSessionName(name);

  if (!sessionExists(sessionName)) {
    console.error(`Error: terminal '${name}' not found.`);
    process.exit(1);
  }

  const { pid, dead, exitCode } = getSessionStatus(sessionName);
  const status = dead ? 'exited' : 'running';
  const lastLines = capturePane(sessionName, 5);

  console.log(`Terminal: ${name}`);
  console.log(`Status:   ${status}`);
  console.log(`PID:      ${pid}`);
  if (dead && exitCode) {
    console.log(`Exit code: ${exitCode}`);
  }
  if (lastLines.trim()) {
    console.log(`\nLast output:\n${lastLines}`);
  }
}
```

- [ ] **Step 6: Implement list command**

Create `src/commands/list.ts`:

```typescript
import { listSessionNames, getSessionStatus, getSessionCommand, getSessionCreated } from '../tmux.js';
import { fromSessionName } from '../naming.js';

interface TerminalInfo {
  name: string;
  command: string;
  pid: string;
  status: 'running' | 'exited';
  uptime: string;
}

function formatUptime(createdEpoch: number): string {
  if (!createdEpoch) return 'unknown';
  const seconds = Math.floor(Date.now() / 1000) - createdEpoch;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function runList(json: boolean): void {
  const sessionNames = listSessionNames();

  if (sessionNames.length === 0) {
    if (json) {
      console.log('[]');
    } else {
      console.log('No active terminals.');
    }
    return;
  }

  const terminals: TerminalInfo[] = sessionNames.map((sn) => {
    const name = fromSessionName(sn);
    const { pid, dead } = getSessionStatus(sn);
    const command = getSessionCommand(sn);
    const created = getSessionCreated(sn);
    return {
      name,
      command,
      pid,
      status: dead ? 'exited' : 'running',
      uptime: formatUptime(created),
    };
  });

  if (json) {
    console.log(JSON.stringify(terminals, null, 2));
    return;
  }

  // Table output
  console.log('NAME'.padEnd(22) + 'STATUS'.padEnd(10) + 'UPTIME'.padEnd(8) + 'COMMAND');
  console.log('-'.repeat(60));
  for (const t of terminals) {
    console.log(t.name.padEnd(22) + t.status.padEnd(10) + t.uptime.padEnd(8) + t.command);
  }
}
```

- [ ] **Step 7: Write command tests**

Create `tests/commands.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tmux module
vi.mock('../src/tmux.js', () => ({
  sessionExists: vi.fn(() => false),
  capturePane: vi.fn(() => 'some output'),
  createSession: vi.fn(),
  sendKeys: vi.fn(),
  killSession: vi.fn(),
  getSessionStatus: vi.fn(() => ({ pid: '12345', dead: false, exitCode: '' })),
  getSessionCommand: vi.fn(() => 'pnpm dev'),
  getSessionCreated: vi.fn(() => Math.floor(Date.now() / 1000) - 60),
  listSessionNames: vi.fn(() => ['at-pnpm-dev']),
}));

import { sessionExists, capturePane, createSession, killSession, listSessionNames } from '../src/tmux.js';
import { runLogs } from '../src/commands/logs.js';
import { runKill } from '../src/commands/kill.js';

describe('logs command', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prints output when session exists', () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runLogs('pnpm-dev', 100);
    expect(capturePane).toHaveBeenCalledWith('at-pnpm-dev', 100);
    spy.mockRestore();
  });

  it('exits with error when session not found', () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => runLogs('nonexistent', 100)).toThrow('exit');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    mockExit.mockRestore();
    spy.mockRestore();
  });
});

describe('kill command', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kills session when it exists', () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runKill('pnpm-dev');
    expect(killSession).toHaveBeenCalledWith('at-pnpm-dev');
    spy.mockRestore();
  });
});
```

- [ ] **Step 8: Run command tests**

Run: `pnpm test -- tests/commands.test.ts`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/commands/ tests/commands.test.ts
git commit -m "feat: add terminal management commands with tests"
```

---

## Task 8: Init Command

**Files:**
- Create: `src/commands/init.ts`

- [ ] **Step 1: Implement init command**

Create `src/commands/init.ts`:

```typescript
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { intro, outro, confirm, multiselect, note, isCancel, cancel } from '@clack/prompts';
import { isTmuxInstalled } from '../tmux.js';
import { getConfigDir, getConfigPath, DEFAULT_CONFIG } from '../config.js';
import { getAllAdapters, detectInstalledAgents } from '../adapters/registry.js';
import type { AgentAdapter } from '../adapters/adapter.js';

export async function runInit(options: { nonInteractive?: boolean; agents?: string }): Promise<void> {
  if (options.nonInteractive) {
    return runNonInteractive(options.agents);
  }

  intro('agent-term init');

  // Step 1: Check tmux
  if (!isTmuxInstalled()) {
    const platform = process.platform;
    const installCmd = platform === 'darwin'
      ? 'brew install tmux'
      : 'sudo apt install tmux';
    note(`tmux is required but not installed.\n\nInstall it with:\n  ${installCmd}`, 'Missing dependency');
    process.exit(1);
  }

  // Step 2: Config file
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  if (existsSync(configPath)) {
    const overwrite = await confirm({ message: 'Config file already exists. Overwrite with defaults?' });
    if (isCancel(overwrite)) { cancel('Setup cancelled.'); process.exit(0); }
    if (overwrite) {
      writeFileSync(configPath, DEFAULT_CONFIG, 'utf-8');
      note(`Updated ${configPath}`, 'Config');
    } else {
      note(`Keeping existing ${configPath}`, 'Config');
    }
  } else {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, DEFAULT_CONFIG, 'utf-8');
    note(`Created ${configPath}`, 'Config');
  }

  // Step 3: Detect agents
  const allAdapters = getAllAdapters();
  const detected = detectInstalledAgents();

  if (allAdapters.length === 0) {
    note('No agent adapters available.', 'Agents');
    outro('Setup complete.');
    return;
  }

  const options_list = allAdapters.map((a) => ({
    value: a.name,
    label: `${a.displayName}${detected.some((d) => d.name === a.name) ? '' : ' (not detected)'}`,
    hint: a.configPath,
  }));

  const selected = await multiselect({
    message: `Found ${detected.length} agent(s) installed. Select which to configure:`,
    options: options_list,
    initialValues: detected.map((a) => a.name),
    required: false,
  });

  if (isCancel(selected)) { cancel('Setup cancelled.'); process.exit(0); }

  // Step 4: Register hooks
  const selectedAdapters = allAdapters.filter((a) => (selected as string[]).includes(a.name));

  for (const adapter of selectedAdapters) {
    adapter.register();
    note(`Registered hook in ${adapter.configPath}`, adapter.displayName);
  }

  outro(`agent-term configured for ${selectedAdapters.length} agent(s). Run 'agent-term list' to see shared terminals.`);
}

async function runNonInteractive(agentNames?: string): Promise<void> {
  if (!isTmuxInstalled()) {
    console.error('Error: tmux is not installed.');
    process.exit(1);
  }

  // Config
  const configDir = getConfigDir();
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, DEFAULT_CONFIG, 'utf-8');
    console.log(`Created ${configPath}`);
  }

  // Agents
  if (agentNames) {
    const names = agentNames.split(',').map((n) => n.trim());
    const allAdapters = getAllAdapters();
    for (const name of names) {
      const adapter = allAdapters.find((a) => a.name === name);
      if (adapter) {
        adapter.register();
        console.log(`Registered hook for ${adapter.displayName}`);
      } else {
        console.warn(`Warning: unknown agent '${name}'`);
      }
    }
  }

  console.log('agent-term setup complete.');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat: add interactive init command with agent auto-detection"
```

---

## Task 9: Wire CLI Subcommands

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Wire all subcommands into the CLI**

Replace `src/cli.ts` with:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('agent-term')
  .description('Shared long-running terminals for AI coding agents')
  .version('0.1.0');

program
  .command('init')
  .description('Set up agent-term: create config, detect and register agent hooks')
  .option('--non-interactive', 'Run without prompts')
  .option('--agents <names>', 'Comma-separated agent names (for non-interactive mode)')
  .action(async (opts) => {
    const { runInit } = await import('./commands/init.js');
    await runInit({ nonInteractive: opts.nonInteractive, agents: opts.agents });
  });

program
  .command('hook')
  .description('Agent pre-hook entry point (called by agents, not users)')
  .requiredOption('--agent <name>', 'Agent adapter name')
  .action(async (opts) => {
    const { runHook } = await import('./commands/hook.js');
    await runHook(opts.agent);
  });

program
  .command('start')
  .description('Start a shared terminal')
  .option('--name <name>', 'Terminal name (auto-generated from command if omitted)')
  .argument('<command...>', 'Command to run')
  .action(async (args, opts) => {
    const { runStart } = await import('./commands/start.js');
    runStart(args, opts.name);
  });

program
  .command('logs')
  .description('Show terminal output')
  .argument('<name>', 'Terminal name')
  .option('--lines <n>', 'Number of lines', '100')
  .action(async (name, opts) => {
    const { runLogs } = await import('./commands/logs.js');
    runLogs(name, parseInt(opts.lines, 10));
  });

program
  .command('send')
  .description('Send input to a terminal')
  .argument('<name>', 'Terminal name')
  .argument('<input>', 'Text or keys to send')
  .action(async (name, input) => {
    const { runSend } = await import('./commands/send.js');
    runSend(name, input);
  });

program
  .command('kill')
  .description('Kill a shared terminal')
  .argument('<name>', 'Terminal name')
  .action(async (name) => {
    const { runKill } = await import('./commands/kill.js');
    runKill(name);
  });

program
  .command('status')
  .description('Show terminal status')
  .argument('<name>', 'Terminal name')
  .action(async (name) => {
    const { runStatus } = await import('./commands/status.js');
    runStatus(name);
  });

program
  .command('list')
  .description('List active terminals')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { runList } = await import('./commands/list.js');
    runList(opts.json ?? false);
  });

program.parse();
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Compiles with no errors.

- [ ] **Step 3: Test CLI locally**

Run: `node dist/cli.js --help`
Expected: Shows all subcommands (init, hook, start, logs, send, kill, status, list).

Run: `node dist/cli.js list`
Expected: "No active terminals." (if tmux is installed) or an error message about tmux.

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: wire all subcommands into CLI entry point"
```

---

## Task 10: Run All Tests + Final Build

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: All tests pass (naming, config, tmux, claude-code, registry, hook).

- [ ] **Step 2: Run a full build**

Run: `pnpm build`
Expected: Clean compile.

- [ ] **Step 3: Test the bin link locally**

Run: `pnpm link --global`
Then: `agent-term --help`
Expected: CLI works from anywhere.

Then: `agent-term list`
Expected: "No active terminals." or tmux not installed message.

- [ ] **Step 4: Test with a real command (if tmux is available)**

Run: `agent-term start -- sleep 30`
Then: `agent-term list`
Expected: Shows "sleep-30" terminal with "running" status.

Then: `agent-term status sleep-30`
Expected: Shows running, PID.

Then: `agent-term kill sleep-30`
Then: `agent-term list`
Expected: "No active terminals."

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: test and build fixes for agent-term"
```
