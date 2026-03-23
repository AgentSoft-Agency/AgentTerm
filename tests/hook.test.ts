import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processHook } from '../src/commands/hook.js';
import type { HookResult } from '../src/adapters/adapter.js';

// Mock tmux
vi.mock('../src/tmux.js', () => ({
  sessionExists: vi.fn(() => false),
  listSessionNames: vi.fn(() => []),
}));

// Mock config
vi.mock('../src/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config.js')>();
  return {
    ...actual,
    loadPatterns: vi.fn(() => ['pnpm dev*', 'docker compose up*']),
  };
});

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
