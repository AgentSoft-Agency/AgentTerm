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
