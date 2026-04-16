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
