import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    rmSync: vi.fn(),
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
