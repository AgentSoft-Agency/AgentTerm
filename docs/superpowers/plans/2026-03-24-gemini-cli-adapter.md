# Gemini CLI Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Gemini CLI stub adapter with a full implementation so agent-term can intercept and route long-running commands from Gemini CLI sessions.

**Architecture:** Mirror the Claude Code adapter pattern — same AgentAdapter interface, same merge-based registration, same passthrough/rewrite output contract. Differences are limited to Gemini-specific JSON field names and hook event naming.

**Tech Stack:** TypeScript (ESM), Vitest, Node.js fs/path/os

**Spec:** `docs/superpowers/specs/2026-03-24-gemini-cli-adapter-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/adapters/gemini-cli.ts` | Modify | Full adapter: detect, register, unregister, parseHookInput, formatHookOutput |
| `tests/gemini-cli.test.ts` | Create | Unit tests for all adapter methods |
| `README.md` | Modify | Update status table |

---

### Task 1: Input Parsing — Tests

**Files:**
- Create: `tests/gemini-cli.test.ts`

- [ ] **Step 1: Write failing tests for parseHookInput**

```typescript
import { describe, it, expect } from 'vitest';
import { GeminiCliAdapter } from '../src/adapters/gemini-cli.js';

describe('GeminiCliAdapter', () => {
  const adapter = new GeminiCliAdapter();

  describe('parseHookInput', () => {
    it('extracts command and sessionId from BeforeTool stdin', () => {
      const stdin = JSON.stringify({
        session_id: 'gem-session-1',
        hook_event_name: 'BeforeTool',
        tool_name: 'run_shell_command',
        tool_input: { command: 'pnpm dev' },
        cwd: '/tmp/project',
        transcript_path: '/tmp/transcript',
        timestamp: '2026-03-24T12:00:00Z',
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: 'pnpm dev', sessionId: 'gem-session-1' });
    });

    it('handles missing session_id', () => {
      const stdin = JSON.stringify({
        tool_input: { command: 'git status' },
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: 'git status', sessionId: undefined });
    });

    it('returns empty command when tool_input is missing', () => {
      const stdin = JSON.stringify({ session_id: 'abc' });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: '', sessionId: 'abc' });
    });

    it('returns empty command when tool_input.command is missing', () => {
      const stdin = JSON.stringify({ tool_input: { args: ['--flag'] } });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: '', sessionId: undefined });
    });

    it('returns empty command for malformed JSON', () => {
      const result = adapter.parseHookInput('not json {{{');
      expect(result).toEqual({ command: '' });
    });

    it('returns empty command for empty string', () => {
      const result = adapter.parseHookInput('');
      expect(result).toEqual({ command: '' });
    });

    it('ignores extra fields gracefully', () => {
      const stdin = JSON.stringify({
        session_id: 'x',
        tool_input: { command: 'ls' },
        mcp_context: { server: 'test' },
        original_request_name: 'run_shell_command',
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: 'ls', sessionId: 'x' });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term && pnpm test -- tests/gemini-cli.test.ts`
Expected: FAIL — current stub returns `{ command: '' }` for all inputs and logs warnings

---

### Task 2: Input Parsing — Implementation

**Files:**
- Modify: `src/adapters/gemini-cli.ts`

- [ ] **Step 3: Implement parseHookInput**

Replace the stub `parseHookInput` method with:

```typescript
parseHookInput(stdin: string): HookInput {
  try {
    const data = JSON.parse(stdin);
    return {
      command: data.tool_input?.command ?? '',
      sessionId: data.session_id,
    };
  } catch {
    return { command: '' };
  }
}
```

The `console.warn` calls in `register`, `unregister`, and `parseHookInput` will be replaced by the real implementations in their respective tasks.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term && pnpm test -- tests/gemini-cli.test.ts`
Expected: All 7 parseHookInput tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term
git add tests/gemini-cli.test.ts src/adapters/gemini-cli.ts
git commit -m "feat(gemini-cli): implement parseHookInput with defensive JSON parsing"
```

---

### Task 3: Output Formatting — Tests

**Files:**
- Modify: `tests/gemini-cli.test.ts`

- [ ] **Step 6: Add failing tests for formatHookOutput**

Append to the `GeminiCliAdapter` describe block:

```typescript
describe('formatHookOutput', () => {
  it('returns empty string for passthrough', () => {
    const result = adapter.formatHookOutput({ action: 'passthrough' });
    expect(result).toBe('');
  });

  it('formats rewrite with decision and tool_input', () => {
    const result = adapter.formatHookOutput({
      action: 'rewrite',
      rewrittenCommand: 'agent-term start --name pnpm-dev -- pnpm dev',
      systemMessage: "Command routed to shared terminal 'pnpm-dev' via agent-term.",
    });
    const parsed = JSON.parse(result);
    expect(parsed.decision).toBe('allow');
    expect(parsed.hookSpecificOutput.tool_input.command).toBe(
      'agent-term start --name pnpm-dev -- pnpm dev',
    );
    expect(parsed.systemMessage).toContain('pnpm-dev');
  });

  it('defaults systemMessage to empty string when omitted', () => {
    const result = adapter.formatHookOutput({
      action: 'rewrite',
      rewrittenCommand: 'agent-term logs my-server --lines 50',
    });
    const parsed = JSON.parse(result);
    expect(parsed.systemMessage).toBe('');
    expect(parsed.hookSpecificOutput.tool_input.command).toBe(
      'agent-term logs my-server --lines 50',
    );
  });
});
```

- [ ] **Step 7: Run tests to verify new tests fail**

Run: `cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term && pnpm test -- tests/gemini-cli.test.ts`
Expected: formatHookOutput rewrite tests FAIL (stub returns empty string for all)

---

### Task 4: Output Formatting — Implementation

**Files:**
- Modify: `src/adapters/gemini-cli.ts`

- [ ] **Step 8: Implement formatHookOutput**

Replace the stub `formatHookOutput` method with:

```typescript
formatHookOutput(result: HookResult): string {
  if (result.action === 'passthrough') return '';

  return JSON.stringify({
    decision: 'allow',
    hookSpecificOutput: {
      tool_input: {
        command: result.rewrittenCommand ?? '',
      },
    },
    systemMessage: result.systemMessage ?? '',
  });
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term && pnpm test -- tests/gemini-cli.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 10: Commit**

```bash
cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term
git add tests/gemini-cli.test.ts src/adapters/gemini-cli.ts
git commit -m "feat(gemini-cli): implement formatHookOutput with Gemini rewrite format"
```

---

### Task 5: Registration — Tests

**Files:**
- Modify: `tests/gemini-cli.test.ts`

- [ ] **Step 11: Add failing tests for register/unregister**

These tests need to mock the filesystem. Add the following **at the top of the file** (replacing the existing imports):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});
```

Then append these describe blocks **inside** the existing `GeminiCliAdapter` describe block:

describe('register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates settings with hook when file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    adapter.register();

    expect(writeFileSync).toHaveBeenCalledOnce();
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.hooks.BeforeTool).toHaveLength(1);
    expect(written.hooks.BeforeTool[0].matcher).toBe('run_shell_command');
    expect(written.hooks.BeforeTool[0].hooks[0].name).toBe('agent-term');
    expect(written.hooks.BeforeTool[0].hooks[0].command).toBe('agent-term hook --agent gemini-cli');
    expect(written.hooks.BeforeTool[0].hooks[0].timeout).toBe(15000);
  });

  it('merges with existing settings without clobbering', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      mcpServers: { test: {} },
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }],
      },
    }));

    adapter.register();

    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.mcpServers).toEqual({ test: {} });
    expect(written.hooks.SessionStart).toHaveLength(1);
    expect(written.hooks.BeforeTool).toHaveLength(1);
  });

  it('skips registration when already registered', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      hooks: {
        BeforeTool: [{
          matcher: 'run_shell_command',
          hooks: [{ name: 'agent-term', type: 'command', command: 'agent-term hook --agent gemini-cli', timeout: 15000 }],
        }],
      },
    }));

    adapter.register();

    expect(writeFileSync).toHaveBeenCalledOnce();
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.hooks.BeforeTool).toHaveLength(1);
  });
});

describe('unregister', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes agent-term hook by name', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      hooks: {
        BeforeTool: [
          { matcher: 'run_shell_command', hooks: [{ name: 'agent-term', type: 'command', command: 'agent-term hook --agent gemini-cli' }] },
          { matcher: 'write_file', hooks: [{ type: 'command', command: 'lint-check.sh' }] },
        ],
      },
    }));

    adapter.unregister();

    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.hooks.BeforeTool).toHaveLength(1);
    expect(written.hooks.BeforeTool[0].matcher).toBe('write_file');
  });

  it('handles missing hooks gracefully', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ mcpServers: {} }));

    adapter.unregister();

    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('removes BeforeTool key when array becomes empty', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      hooks: {
        BeforeTool: [
          { matcher: 'run_shell_command', hooks: [{ name: 'agent-term', command: 'agent-term hook --agent gemini-cli' }] },
        ],
        SessionStart: [{ hooks: [{ command: 'other.sh' }] }],
      },
    }));

    adapter.unregister();

    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.hooks.BeforeTool).toBeUndefined();
    expect(written.hooks.SessionStart).toHaveLength(1);
  });
});
```

- [ ] **Step 12: Run tests to verify they fail**

Run: `cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term && pnpm test -- tests/gemini-cli.test.ts`
Expected: register/unregister tests FAIL — stubs just log warnings

---

### Task 6: Registration — Implementation

**Files:**
- Modify: `src/adapters/gemini-cli.ts`

- [ ] **Step 13: Implement register, unregister, and private helpers**

Replace the full file content with:

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
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
    const settings = this.readSettings();
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.BeforeTool) settings.hooks.BeforeTool = [];

    const existing = settings.hooks.BeforeTool as any[];
    const alreadyRegistered = existing.some((entry: any) =>
      entry.hooks?.some((h: any) =>
        h.name === 'agent-term' ||
        (typeof h.command === 'string' && h.command.includes('agent-term')),
      ),
    );

    if (!alreadyRegistered) {
      existing.push({
        matcher: 'run_shell_command',
        hooks: [{
          name: 'agent-term',
          type: 'command',
          command: 'agent-term hook --agent gemini-cli',
          timeout: 15000,
        }],
      });
    }

    this.writeSettings(settings);
  }

  unregister(): void {
    const settings = this.readSettings();
    if (!settings.hooks?.BeforeTool) return;

    settings.hooks.BeforeTool = (settings.hooks.BeforeTool as any[]).filter(
      (entry: any) => !entry.hooks?.some((h: any) =>
        h.name === 'agent-term' ||
        (typeof h.command === 'string' && h.command.includes('agent-term')),
      ),
    );

    if ((settings.hooks.BeforeTool as any[]).length === 0) {
      delete settings.hooks.BeforeTool;
    }

    this.writeSettings(settings);
  }

  parseHookInput(stdin: string): HookInput {
    try {
      const data = JSON.parse(stdin);
      return {
        command: data.tool_input?.command ?? '',
        sessionId: data.session_id,
      };
    } catch {
      return { command: '' };
    }
  }

  formatHookOutput(result: HookResult): string {
    if (result.action === 'passthrough') return '';

    return JSON.stringify({
      decision: 'allow',
      hookSpecificOutput: {
        tool_input: {
          command: result.rewrittenCommand ?? '',
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

- [ ] **Step 14: Run tests to verify they pass**

Run: `cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term && pnpm test -- tests/gemini-cli.test.ts`
Expected: All tests PASS

- [ ] **Step 15: Commit**

```bash
cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term
git add src/adapters/gemini-cli.ts tests/gemini-cli.test.ts
git commit -m "feat(gemini-cli): implement register/unregister with name-based detection"
```

---

### Task 7: README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 16: Update the supported agents table**

In `README.md`, change line 18:

```markdown
| Gemini CLI | Stub (adapter ready, hook format TBD) |
```

to:

```markdown
| Gemini CLI | Fully supported |
```

- [ ] **Step 17: Run full test suite**

Run: `cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term && pnpm test`
Expected: All tests PASS (existing + new)

- [ ] **Step 18: Commit**

```bash
cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term
git add README.md
git commit -m "docs: mark Gemini CLI as fully supported"
```

---

### Task 8: Build Verification

- [ ] **Step 19: Verify TypeScript compiles**

Run: `cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term && pnpm build`
Expected: Clean compile, no errors

- [ ] **Step 20: Run full test suite one final time**

Run: `cd /Users/alexandervazquez/Projects/DevChrisVaz/AgentSoft/agent-term && pnpm test`
Expected: All tests PASS
