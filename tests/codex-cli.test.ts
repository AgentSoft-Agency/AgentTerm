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
