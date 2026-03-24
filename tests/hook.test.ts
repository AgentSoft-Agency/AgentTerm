import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processHook } from '../src/commands/hook.js';
import type { HookResult } from '../src/adapters/adapter.js';

// Mock tmux
vi.mock('../src/tmux.js', () => ({
  createSessionWithRemainOnExit: vi.fn(() => true),
  getSessionStatus: vi.fn(() => ({ pid: '1234', dead: false, exitCode: '' })),
  capturePane: vi.fn(() => 'some output'),
  killSession: vi.fn(),
  setRemainOnExit: vi.fn(),
}));

// Mock naming
vi.mock('../src/naming.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/naming.js')>();
  return {
    ...actual,
    uniqueSuffix: vi.fn(() => 'a3f0'),
  };
});

import {
  createSessionWithRemainOnExit,
  getSessionStatus,
  capturePane,
  killSession,
  setRemainOnExit,
} from '../src/tmux.js';

describe('processHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns passthrough for agent-term commands', async () => {
    const result = await processHook('agent-term logs pnpm-dev');
    expect(result.action).toBe('passthrough');
    expect(createSessionWithRemainOnExit).not.toHaveBeenCalled();
  });

  it('returns passthrough for empty commands', async () => {
    const result = await processHook('');
    expect(result.action).toBe('passthrough');
  });

  it('returns passthrough for whitespace-only commands', async () => {
    const result = await processHook('   ');
    expect(result.action).toBe('passthrough');
  });

  it('returns output when command exits quickly', async () => {
    vi.mocked(getSessionStatus).mockReturnValue({ pid: '1234', dead: true, exitCode: '0' });
    vi.mocked(capturePane).mockReturnValue('file1.ts\nfile2.ts');

    const result = await processHook('ls');
    expect(result.action).toBe('output');
    expect(result.stdout).toBe('file1.ts\nfile2.ts');
    expect(killSession).toHaveBeenCalled();
  });

  it('returns rewrite when command is still running at deadline', async () => {
    vi.mocked(getSessionStatus).mockReturnValue({ pid: '1234', dead: false, exitCode: '' });
    vi.mocked(capturePane).mockReturnValue('Starting dev server...');

    // Use a very short deadline for testing
    const result = await processHook('pnpm dev', 200);
    expect(result.action).toBe('rewrite');
    expect(result.rewrittenCommand).toContain('agent-term logs');
    expect(result.systemMessage).toContain('still running');
    expect(setRemainOnExit).toHaveBeenCalledWith(expect.any(String), false);
  });

  it('falls back to passthrough when tmux session creation fails', async () => {
    vi.mocked(createSessionWithRemainOnExit).mockReturnValue(false);

    const result = await processHook('pnpm build');
    expect(result.action).toBe('passthrough');
  });

  it('creates session with unique name', async () => {
    vi.mocked(getSessionStatus).mockReturnValue({ pid: '1234', dead: true, exitCode: '0' });

    await processHook('git status');
    expect(createSessionWithRemainOnExit).toHaveBeenCalledWith(
      'at-git-status-a3f0',
      'git status',
    );
  });
});
