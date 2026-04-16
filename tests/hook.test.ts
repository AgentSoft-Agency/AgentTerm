import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processHook, isLongRunning } from '../src/commands/hook.js';
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

describe('isLongRunning', () => {
  it('matches dev server commands', () => {
    expect(isLongRunning('pnpm dev')).toBe(true);
    expect(isLongRunning('pnpm run dev')).toBe(true);
    expect(isLongRunning('npm start')).toBe(true);
    expect(isLongRunning('yarn serve')).toBe(true);
    expect(isLongRunning('bun run watch')).toBe(true);
    expect(isLongRunning('npx dev')).toBe(true);
  });

  it('matches node/runtime processes', () => {
    expect(isLongRunning('node server.js')).toBe(true);
    expect(isLongRunning('nodemon app.ts')).toBe(true);
    expect(isLongRunning('tsx watch src/index.ts')).toBe(true);
    expect(isLongRunning('vite')).toBe(true);
    expect(isLongRunning('next dev')).toBe(true);
  });

  it('matches docker commands', () => {
    expect(isLongRunning('docker compose up')).toBe(true);
    expect(isLongRunning('docker run -p 3000:3000 myapp')).toBe(true);
    expect(isLongRunning('docker-compose up -d')).toBe(true);
  });

  it('matches build commands', () => {
    expect(isLongRunning('pnpm build')).toBe(true);
    expect(isLongRunning('pnpm run build')).toBe(true);
    expect(isLongRunning('npm run build')).toBe(true);
    expect(isLongRunning('make')).toBe(true);
    expect(isLongRunning('cargo build')).toBe(true);
  });

  it('matches tail -f', () => {
    expect(isLongRunning('tail -f /var/log/syslog')).toBe(true);
    expect(isLongRunning('tail -F app.log')).toBe(true);
  });

  it('matches terraform', () => {
    expect(isLongRunning('terraform apply')).toBe(true);
    expect(isLongRunning('terraform plan')).toBe(true);
  });

  it('does NOT match short-lived commands', () => {
    expect(isLongRunning('git status')).toBe(false);
    expect(isLongRunning('git diff README.md')).toBe(false);
    expect(isLongRunning('git add .')).toBe(false);
    expect(isLongRunning('git commit -m "test"')).toBe(false);
    expect(isLongRunning('git log --oneline')).toBe(false);
    expect(isLongRunning('cat package.json')).toBe(false);
    expect(isLongRunning('grep -r "foo" src/')).toBe(false);
    expect(isLongRunning('ls -la')).toBe(false);
    expect(isLongRunning('echo hello')).toBe(false);
    expect(isLongRunning('pwd')).toBe(false);
    expect(isLongRunning('mkdir -p src/foo')).toBe(false);
    expect(isLongRunning('cp file1 file2')).toBe(false);
    expect(isLongRunning('rm -rf dist')).toBe(false);
    expect(isLongRunning('pnpm install')).toBe(false);
    expect(isLongRunning('pnpm add lodash')).toBe(false);
    expect(isLongRunning('npm install')).toBe(false);
  });
});

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

  it('returns passthrough for short-lived commands', async () => {
    const result = await processHook('git status');
    expect(result.action).toBe('passthrough');
    expect(createSessionWithRemainOnExit).not.toHaveBeenCalled();
  });

  it('returns passthrough for git diff', async () => {
    const result = await processHook('git diff PERMISSIONS.md');
    expect(result.action).toBe('passthrough');
    expect(createSessionWithRemainOnExit).not.toHaveBeenCalled();
  });

  it('returns passthrough for grep commands', async () => {
    const result = await processHook('grep -r "pattern" src/');
    expect(result.action).toBe('passthrough');
    expect(createSessionWithRemainOnExit).not.toHaveBeenCalled();
  });

  it('routes dev server through tmux', async () => {
    vi.mocked(getSessionStatus).mockReturnValue({ pid: '1234', dead: false, exitCode: '' });

    const result = await processHook('pnpm dev', 200);
    expect(result.action).toBe('rewrite');
    expect(createSessionWithRemainOnExit).toHaveBeenCalled();
  });

  it('returns output when long-running command exits quickly', async () => {
    vi.mocked(getSessionStatus).mockReturnValue({ pid: '1234', dead: true, exitCode: '0' });
    vi.mocked(capturePane).mockReturnValue('Build succeeded');

    const result = await processHook('pnpm build');
    expect(result.action).toBe('output');
    expect(result.stdout).toBe('Build succeeded');
    expect(killSession).toHaveBeenCalled();
  });

  it('returns rewrite when long-running command is still running at deadline', async () => {
    vi.mocked(getSessionStatus).mockReturnValue({ pid: '1234', dead: false, exitCode: '' });
    vi.mocked(capturePane).mockReturnValue('Starting dev server...');

    const result = await processHook('pnpm dev', 200);
    expect(result.action).toBe('rewrite');
    expect(result.rewrittenCommand).toContain('agent-term logs');
    expect(result.systemMessage).toContain('still running');
    expect(setRemainOnExit).toHaveBeenCalledWith(expect.any(String), false);
  });

  it('falls back to passthrough when tmux session creation fails', async () => {
    vi.mocked(createSessionWithRemainOnExit).mockReturnValue(false);

    const result = await processHook('pnpm dev');
    expect(result.action).toBe('passthrough');
  });

  it('creates session with unique name for long-running commands', async () => {
    vi.mocked(getSessionStatus).mockReturnValue({ pid: '1234', dead: true, exitCode: '0' });

    await processHook('pnpm build');
    expect(createSessionWithRemainOnExit).toHaveBeenCalledWith(
      'at-pnpm-build-a3f0',
      'pnpm build',
    );
  });
});
