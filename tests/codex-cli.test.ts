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
