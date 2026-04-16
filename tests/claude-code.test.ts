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
