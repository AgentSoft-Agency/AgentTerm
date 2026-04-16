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
