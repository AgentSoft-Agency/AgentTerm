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
